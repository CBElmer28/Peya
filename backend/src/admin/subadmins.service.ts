import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { businessError } from '../common/business-error';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../access-control/permissions.service';
import { AdminAuditService } from '../access-control/admin-audit.service';
import { CreateSubadminDto } from './dto/subadmin.dto';

export interface SubadminView {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  roles: string[];
  permissions: string[];
  createdAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED_ESCALATION = 'No puedes asignar ni modificar privilegios que tú mismo no posees.';
const sorted = (s: Iterable<string>) => [...s].sort();

type TxResult = { ok: true; view: SubadminView } | { ok: false; message: string };

@Injectable()
export class SubadminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly permissions: PermissionsService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(): Promise<SubadminView[]> {
    const admins = await this.prisma.admin.findMany({ orderBy: { fecha_creacion: 'asc' } });
    const result: SubadminView[] = [];
    for (const a of admins) {
      const { roles, permissions } = await this.currentRoles(this.prisma, a.id);
      result.push(this.toView(a, roles, permissions));
    }
    return result;
  }

  /** Roles activos cuyos permisos el actor posee por completo: los unicos que puede asignar. */
  async assignableRoles(actor: AuthUser): Promise<{ name: string; description: string | null; permissions: string[] }[]> {
    const actorAccess = await this.permissions.effectiveFor(actor.id);
    const rows = await this.prisma.$queryRaw<{ rol: string; descripcion: string | null; codigo: string | null }[]>`
      SELECT r.nombre AS rol, r.descripcion, p.codigo
      FROM rol r
      LEFT JOIN rol_permiso rp ON rp.id_rol = r.id
      LEFT JOIN permiso p ON p.id = rp.id_permiso
      WHERE r.estado = 'ACTIVO'`;
    const byRole = new Map<string, { description: string | null; permissions: Set<string> }>();
    for (const row of rows) {
      const entry = byRole.get(row.rol) ?? { description: row.descripcion, permissions: new Set<string>() };
      if (row.codigo) entry.permissions.add(row.codigo);
      byRole.set(row.rol, entry);
    }
    return [...byRole.entries()]
      .filter(([, r]) => [...r.permissions].every((p) => actorAccess.permissions.has(p)))
      .map(([name, r]) => ({ name, description: r.description, permissions: sorted(r.permissions) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** HU16: registro con identidad unica y roles autorizados. Todo en una transaccion junto con su auditoria. */
  async create(actor: AuthUser, dto: CreateSubadminDto, ip: string): Promise<SubadminView> {
    const email = dto.email.trim().toLowerCase();
    const roleNames = [...new Set(dto.roles)];
    const found = await this.permissions.rolesByName(roleNames);
    const unknown = roleNames.filter((n) => !found.has(n));
    if (unknown.length) throw businessError(422, 'ROLE_NOT_FOUND', 'Alguno de los roles indicados no existe o está inactivo.');

    const actorAccess = await this.permissions.effectiveFor(actor.id);
    const requested = new Set<string>();
    found.forEach((r) => r.permissions.forEach((p) => requested.add(p)));
    if (![...requested].every((p) => actorAccess.permissions.has(p))) {
      await this.audit.recordSafe({
        actorId: actor.id,
        action: 'SUBADMIN_CREAR',
        objectType: 'ADMIN',
        result: 'DENEGADO',
        after: { roles: sorted(roleNames) },
        ip,
      });
      throw businessError(403, 'PRIVILEGE_ESCALATION', DENIED_ESCALATION);
    }

    if (await this.users.findByEmail(email)) {
      throw businessError(409, 'EMAIL_IN_USE', 'El correo electrónico ya está en uso por otro usuario.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.transaction(async (tx) => {
        const created = await tx.admin.create({
          data: {
            nombre_usuario: dto.name.trim(),
            correo: email,
            password_hash: passwordHash,
            id_creador: actorAccess.kind === 'admin' ? actor.id : null,
          },
        });
        await tx.admin_rol.createMany({
          data: roleNames.map((n) => ({ id_admin: created.id, id_rol: found.get(n)!.id })),
        });
        const roles = sorted(roleNames);
        const permissions = sorted(requested);
        await this.audit.record(
          {
            actorId: actor.id,
            action: 'SUBADMIN_CREAR',
            objectType: 'ADMIN',
            objectId: created.id,
            result: 'EXITO',
            after: { roles, permissions, estado: created.estado },
            ip,
          },
          tx,
        );
        return this.toView(created, roles, permissions);
      });
    } catch (e) {
      // Carrera entre dos altas con el mismo correo: el indice unico lower(correo) es la defensa final.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw businessError(409, 'EMAIL_IN_USE', 'El correo electrónico ya está en uso por otro usuario.');
      }
      throw e;
    }
  }

  /**
   * Reemplaza los roles de un administrador. Reglas de no-escalada:
   *  - nadie modifica sus propios roles;
   *  - los roles nuevos no pueden superar los permisos propios del actor;
   *  - no se puede tocar a quien tiene permisos que el actor no posee.
   */
  async changeRoles(actor: AuthUser, targetId: string, roleNames: string[], ip: string): Promise<SubadminView> {
    if (!UUID_RE.test(targetId)) throw new NotFoundException('Administrador no encontrado');
    const names = [...new Set(roleNames)];

    if (targetId.toLowerCase() === actor.id.toLowerCase()) {
      await this.audit.recordSafe({
        actorId: actor.id,
        action: 'SUBADMIN_ROLES_CAMBIAR',
        objectType: 'ADMIN',
        objectId: targetId,
        result: 'DENEGADO',
        after: { roles: sorted(names) },
        ip,
      });
      throw businessError(403, 'SELF_PRIVILEGE_CHANGE', 'No puedes modificar tus propios privilegios.');
    }

    const found = await this.permissions.rolesByName(names);
    if (names.some((n) => !found.has(n))) {
      throw businessError(422, 'ROLE_NOT_FOUND', 'Alguno de los roles indicados no existe o está inactivo.');
    }
    const actorAccess = await this.permissions.effectiveFor(actor.id);

    const result = await this.prisma.transaction<TxResult>(async (tx): Promise<TxResult> => {
      // Bloquea al objetivo: dos cambios simultaneos se serializan y cada uno ve el estado real.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM admin WHERE id = ${targetId}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException('Administrador no encontrado');

      const before = await this.currentRoles(tx, targetId);
      const requested = new Set<string>();
      found.forEach((r) => r.permissions.forEach((p) => requested.add(p)));

      const covers = (needed: Iterable<string>) => [...needed].every((p) => actorAccess.permissions.has(p));
      if (!covers(requested) || !covers(before.permissions)) {
        await this.audit.record(
          {
            actorId: actor.id,
            action: 'SUBADMIN_ROLES_CAMBIAR',
            objectType: 'ADMIN',
            objectId: targetId,
            result: 'DENEGADO',
            before: { roles: before.roles, permissions: before.permissions },
            after: { roles: sorted(names), permissions: sorted(requested) },
            ip,
          },
          tx,
        );
        return { ok: false, message: DENIED_ESCALATION };
      }

      const ids = names.map((n) => found.get(n)!.id);
      await tx.admin_rol.deleteMany({ where: { id_admin: targetId, id_rol: { notIn: ids } } });
      await tx.admin_rol.createMany({ data: ids.map((id_rol) => ({ id_admin: targetId, id_rol })), skipDuplicates: true });
      const updated = await tx.admin.update({ where: { id: targetId }, data: { fecha_actualizacion: new Date() } });

      const after = await this.currentRoles(tx, targetId);
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'SUBADMIN_ROLES_CAMBIAR',
          objectType: 'ADMIN',
          objectId: targetId,
          result: 'EXITO',
          before: { roles: before.roles, permissions: before.permissions },
          after: { roles: after.roles, permissions: after.permissions },
          ip,
        },
        tx,
      );
      return { ok: true, view: this.toView(updated, after.roles, after.permissions) };
    });

    if (result.ok === false) throw businessError(403, 'PRIVILEGE_ESCALATION', result.message);
    return result.view;
  }

  private async currentRoles(client: Tx | PrismaService, adminId: string) {
    const rows = await client.$queryRaw<{ rol: string; codigo: string | null }[]>`
      SELECT r.nombre AS rol, p.codigo
      FROM admin_rol ar
      JOIN rol r ON r.id = ar.id_rol
      LEFT JOIN rol_permiso rp ON rp.id_rol = r.id
      LEFT JOIN permiso p ON p.id = rp.id_permiso
      WHERE ar.id_admin = ${adminId}::uuid`;
    return {
      roles: sorted(new Set(rows.map((r) => r.rol))),
      permissions: sorted(new Set(rows.map((r) => r.codigo).filter((c): c is string => !!c))),
    };
  }

  private toView(
    a: { id: string; nombre_usuario: string; correo: string; estado: string; fecha_creacion: Date },
    roles: string[],
    permissions: string[],
  ): SubadminView {
    return {
      id: a.id,
      name: a.nombre_usuario,
      email: a.correo,
      status: a.estado === 'ACTIVO' ? 'active' : 'inactive',
      roles,
      permissions,
      createdAt: a.fecha_creacion.toISOString(),
    };
  }
}
