import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { AdminAuditService } from '../access-control/admin-audit.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { maskCci } from '../common/masking';
import { formatMoney } from '../common/money';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { businessError } from '../common/business-error';

export interface User {
  id: string;
  dni: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: 'client' | 'admin';
  status: 'active' | 'inactive';
  selfieUrl?: string;
  registeredAt: string;
  /** Ultima modificacion (ISO); base del control de concurrencia optimista del perfil. */
  updatedAt: string;
  /** Tabla de origen de la identidad (sesion.id_cliente vs sesion.id_admin). */
  kind?: 'cliente' | 'admin';
}

type ClienteRow = Prisma.clienteGetPayload<object>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUser(c: ClienteRow): User {
  return {
    id: c.id,
    dni: c.dni,
    name: [c.nombres, c.apellidos].filter(Boolean).join(' '),
    email: c.correo,
    phone: c.telefono ?? undefined,
    passwordHash: c.password_hash,
    role: c.rol === 'ADMIN' ? 'admin' : 'client',
    status: c.estado === 'ACTIVO' ? 'active' : 'inactive',
    selfieUrl: c.selfie_url ?? undefined,
    registeredAt: c.fecha_creacion.toISOString().slice(0, 10),
    updatedAt: c.fecha_actualizacion.toISOString(),
    kind: 'cliente',
  };
}

type AdminRow = Prisma.adminGetPayload<object>;

/** Administradores del panel (tabla admin + admin_rol). Siempre role 'admin'. */
function adminToUser(a: AdminRow): User {
  return {
    id: a.id,
    dni: '',
    name: a.nombre_usuario,
    email: a.correo,
    passwordHash: a.password_hash,
    role: 'admin',
    status: a.estado === 'ACTIVO' ? 'active' : 'inactive',
    registeredAt: a.fecha_creacion.toISOString().slice(0, 10),
    updatedAt: a.fecha_actualizacion.toISOString(),
    kind: 'admin',
  };
}

function prismaCode(e: unknown): string | undefined {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string; email: string; name: string }> {
    const cleanDni = dto.dni.trim();
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanPhone = dto.phone.replace(/\D/g, '').replace(/^51/, '');

    const existingDni = await this.prisma.cliente.findUnique({ where: { dni: cleanDni } });
    if (existingDni) {
      throw new ConflictException({
        statusCode: 409,
        message: 'El DNI ingresado ya se encuentra registrado en BankHub.',
        userName: toUser(existingDni).name,
      });
    }

    if (await this.findByEmail(cleanEmail)) {
      throw new ConflictException({
        statusCode: 409,
        message: 'El correo electrónico ya está en uso por otro usuario.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, await bcrypt.genSalt(10));

    try {
      const created = await this.prisma.transaction((tx) =>
        tx.cliente.create({
          data: {
            dni: cleanDni,
            nombres: dto.name?.trim() || 'Priscilla Fernanda Quispe Torres',
            correo: cleanEmail,
            telefono: cleanPhone,
            password_hash: passwordHash,
            rol: 'CLIENTE',
            estado: 'ACTIVO',
            selfie_url: dto.selfieUrl,
          },
        }),
      );
      const u = toUser(created);
      return { userId: u.id, email: u.email, name: u.name };
    } catch (e) {
      // Carrera entre dos registros simultaneos: la restriccion UNIQUE es la defensa final.
      if (prismaCode(e) === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          message: 'El DNI o correo electrónico ya se encuentra registrado.',
        });
      }
      throw e;
    }
  }

  async checkDni(dni: string): Promise<{ exists: boolean; userName?: string }> {
    const c = await this.prisma.cliente.findUnique({ where: { dni: dni.trim() } });
    return { exists: !!c, userName: c ? toUser(c).name : undefined };
  }

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    return { exists: !!(await this.findByEmail(email)) };
  }

  async findByEmail(email: string): Promise<User | null> {
    const c = await this.prisma.cliente.findFirst({
      where: { correo: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (c) return toUser(c);
    return this.findAdminByEmail(email);
  }

  private async findAdminByEmail(email: string): Promise<User | null> {
    const a = await this.prisma.admin.findFirst({
      where: { correo: { equals: email.trim(), mode: 'insensitive' } },
    });
    return a ? adminToUser(a) : null;
  }

  async findById(id: string): Promise<User | null> {
    if (!UUID_RE.test(id)) return null;
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    if (c) return toUser(c);
    const a = await this.prisma.admin.findUnique({ where: { id } });
    return a ? adminToUser(a) : null;
  }

  /**
   * HU14: perfil del titular del token. El id llega del JWT validado (nunca de params/query/body)
   * y los datos se releen de la BD en cada llamada, no del payload del token.
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.findById(userId);
    if (!user || user.status !== 'active') throw new NotFoundException('Perfil no encontrado');
    return ProfileResponseDto.from(user);
  }

  /**
   * HU15: actualiza el correo del titular del token (unico dato editable). Todo ocurre en UNA transaccion con la fila
   * bloqueada (FOR UPDATE): las validaciones y el UPDATE ven el mismo estado, y si algo falla no se
   * persiste nada. expectedUpdatedAt permite detectar que otra sesion modifico el perfil entretanto.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    if (!UUID_RE.test(userId)) throw new NotFoundException('Perfil no encontrado');
    if (dto.email === undefined) {
      throw businessError(400, 'NO_CHANGES', 'Indica el campo a actualizar (email).');
    }
    const email = dto.email.trim().toLowerCase();

    type Row = { correo: string; password_hash: string; estado: string; fecha_actualizacion: Date };
    try {
      await this.prisma.transaction(async (tx) => {
        let kind: 'cliente' | 'admin' = 'cliente';
        let rows = await tx.$queryRaw<Row[]>`
          SELECT correo, password_hash, estado, fecha_actualizacion
          FROM cliente WHERE id = ${userId}::uuid FOR UPDATE`;
        if (!rows.length) {
          kind = 'admin';
          rows = await tx.$queryRaw<Row[]>`
            SELECT correo, password_hash, estado, fecha_actualizacion
            FROM admin WHERE id = ${userId}::uuid FOR UPDATE`;
        }
        const cur = rows[0];
        if (!cur || cur.estado !== 'ACTIVO') throw new NotFoundException('Perfil no encontrado');

        if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== cur.fecha_actualizacion.getTime()) {
          throw businessError(
            409,
            'PROFILE_CONFLICT',
            'Tu perfil fue modificado desde otra sesión. Vuelve a cargarlo e inténtalo de nuevo.',
          );
        }

        if (email === cur.correo.toLowerCase()) {
          throw businessError(400, 'NO_CHANGES', 'Los datos enviados son iguales a los actuales.');
        }

        if (!dto.currentPassword) {
          throw businessError(400, 'CURRENT_PASSWORD_REQUIRED', 'Para cambiar el correo debes indicar tu contraseña actual.');
        }
        if (!(await bcrypt.compare(dto.currentPassword, cur.password_hash))) {
          throw businessError(403, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual es incorrecta.');
        }
        const taken = await tx.$queryRaw<{ x: number }[]>`
          SELECT 1 AS x FROM cliente WHERE lower(correo) = ${email} AND id <> ${userId}::uuid
          UNION ALL
          SELECT 1 FROM admin WHERE lower(correo) = ${email} AND id <> ${userId}::uuid`;
        if (taken.length) throw businessError(409, 'EMAIL_IN_USE', 'El correo electrónico ya está en uso por otro usuario.');

        const now = new Date();
        if (kind === 'cliente') {
          await tx.cliente.update({
            where: { id: userId },
            data: { correo: email, fecha_actualizacion: now },
          });
        } else {
          await tx.admin.update({
            where: { id: userId },
            data: { correo: email, fecha_actualizacion: now },
          });
        }
      });
    } catch (e) {
      // Carrera entre dos cambios al mismo correo: el indice unico lower(correo) es la defensa final.
      if (prismaCode(e) === 'P2002') {
        throw businessError(409, 'EMAIL_IN_USE', 'El correo electrónico ya está en uso por otro usuario.');
      }
      throw e;
    }
    return this.getProfile(userId);
  }

  /** HU17 · SCRUM-71: Consulta y búsqueda de clientes con filtros y paginación */
  async search(query: QueryUsersDto): Promise<{
    items: (Omit<User, 'passwordHash'> & { accountsCount?: number })[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.clienteWhereInput = {};

    if (query.status && query.status !== 'all') {
      where.estado = query.status === 'active' ? 'ACTIVO' : 'INACTIVO';
    }

    if (query.role && query.role !== 'all') {
      where.rol = query.role === 'admin' ? 'ADMIN' : 'CLIENTE';
    }

    if (query.q && query.q.trim()) {
      const term = query.q.trim();
      where.OR = [
        { dni: { contains: term, mode: 'insensitive' } },
        { correo: { contains: term, mode: 'insensitive' } },
        { nombres: { contains: term, mode: 'insensitive' } },
        { apellidos: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.cliente.count({ where }),
      this.prisma.cliente.findMany({
        where,
        orderBy: { fecha_creacion: 'desc' },
        skip,
        take: pageSize,
        include: {
          cuenta: {
            select: { id: true },
          },
        },
      }),
    ]);

    const items = rows.map((r) => {
      const { passwordHash, selfieUrl, ...safe } = toUser(r);
      return {
        ...safe,
        accountsCount: r.cuenta.length,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /** HU17 · SCRUM-71: Detalle de cliente con sus cuentas bancarias asociadas */
  async getClientDetail(id: string) {
    if (!UUID_RE.test(id)) throw new NotFoundException('Cliente no encontrado');
    const c = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        cuenta: {
          include: { tipo_cuenta: true },
          orderBy: { fecha_apertura: 'asc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado');

    const { passwordHash, selfieUrl, ...safe } = toUser(c);
    const accounts = c.cuenta.map((acc) => ({
      id: acc.id,
      cci: acc.cci,
      maskedCci: maskCci(acc.cci),
      currency: acc.moneda,
      balance: formatMoney(acc.saldo, acc.moneda),
      numericBalance: Number(acc.saldo),
      status: acc.estado_cuenta === 'ACTIVA' ? 'active' : 'blocked',
      type: acc.tipo_cuenta?.nombre ?? 'Cuenta',
      openedAt: acc.fecha_apertura.toISOString(),
    }));

    return {
      ...safe,
      accounts,
    };
  }

  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const rows = await this.prisma.cliente.findMany({ orderBy: { fecha_creacion: 'asc' } });
    return rows.map(toUser).map(({ passwordHash, selfieUrl, ...user }) => user);
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const passwordHash = await bcrypt.hash('123456', 8);
    const dni = Math.floor(10000000 + Math.random() * 90000000).toString();
    try {
      const c = await this.prisma.transaction((tx) =>
        tx.cliente.create({
          data: {
            dni,
            nombres: dto.name,
            correo: dto.email.trim().toLowerCase(),
            password_hash: passwordHash,
            rol: dto.role === 'admin' ? 'ADMIN' : 'CLIENTE',
          },
        }),
      );
      const { passwordHash: _p, selfieUrl: _s, ...user } = toUser(c);
      return user;
    } catch (e) {
      if (prismaCode(e) === 'P2002') throw new ConflictException('El correo electrónico ya está en uso.');
      throw e;
    }
  }

  /**
   * HU17 · SCRUM-72, 73, 75: Actualización de datos del cliente con validación,
   * protección de campos sensibles (DNI/clave/saldos) y auditoría administrativa.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    actor?: AuthUser,
    ip?: string,
  ): Promise<Omit<User, 'passwordHash'>> {
    if (!UUID_RE.test(id)) throw new NotFoundException('Usuario no encontrado');
    return this.prisma.transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; nombres: string; correo: string; telefono: string | null; rol: string; estado: string }[]>`
        SELECT id::text, nombres, correo, telefono, rol, estado
        FROM cliente WHERE id = ${id}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Usuario no encontrado');

      const cur = rows[0];
      const data: Prisma.clienteUpdateInput = { fecha_actualizacion: new Date() };

      if (dto.name && dto.name.trim()) data.nombres = dto.name.trim();
      if (dto.phone !== undefined) {
        data.telefono = dto.phone.replace(/\D/g, '').replace(/^51/, '');
      }
      if (dto.email && dto.email.trim().toLowerCase() !== cur.correo.toLowerCase()) {
        const cleanEmail = dto.email.trim().toLowerCase();
        const taken = await tx.$queryRaw<{ x: number }[]>`
          SELECT 1 AS x FROM cliente WHERE lower(correo) = ${cleanEmail} AND id <> ${id}::uuid
          UNION ALL
          SELECT 1 FROM admin WHERE lower(correo) = ${cleanEmail} AND id <> ${id}::uuid`;
        if (taken.length) {
          throw new ConflictException('El correo electrónico ya está en uso por otro usuario.');
        }
        data.correo = cleanEmail;
      }
      if (dto.role) data.rol = dto.role === 'admin' ? 'ADMIN' : 'CLIENTE';
      if (dto.status) data.estado = dto.status === 'active' ? 'ACTIVO' : 'INACTIVO';
  

      const updated = await tx.cliente.update({ where: { id }, data });

      if (actor) {
        await this.audit.record(
          {
            actorId: actor.id,
            action: 'CLIENTE_ACTUALIZAR',
            objectType: 'CLIENTE',
            objectId: id,
            result: 'EXITO',
            before: { nombres: cur.nombres, correo: cur.correo, telefono: cur.telefono, rol: cur.rol, estado: cur.estado },
            after: {
              nombres: updated.nombres,
              correo: updated.correo,
              telefono: updated.telefono,
              rol: updated.rol,
              estado: updated.estado,
              motivo: dto.reason,
            },
            ip,
          },
          tx,
        );
      }

      const { passwordHash, selfieUrl, ...safe } = toUser(updated);
      return safe;
    });
  }

  /**
   * HU19 · SCRUM-84, 87, 88: Bloqueo de usuarios con concurrencia pesimista FOR UPDATE,
   * revocación inmediata de sesiones JWT activas en la BD y auditoría administrativa.
   */
  async blockUser(id: string, reason?: string, actor?: AuthUser, ip?: string) {
    if (!UUID_RE.test(id)) throw new NotFoundException('Usuario no encontrado');
    if (actor && actor.id.toLowerCase() === id.toLowerCase()) {
      throw businessError(403, 'SELF_PRIVILEGE_CHANGE', 'No puedes bloquear tu propia cuenta.');
    }

    return this.prisma.transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; estado: string; correo: string }[]>`
        SELECT id::text, estado, correo FROM cliente WHERE id = ${id}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Usuario no encontrado');

      const cur = rows[0];
      if (cur.estado === 'INACTIVO') {
        throw businessError(409, 'USER_ALREADY_BLOCKED', 'El usuario ya se encuentra bloqueado.');
      }

      await tx.cliente.update({
        where: { id },
        data: { estado: 'INACTIVO', fecha_actualizacion: new Date() },
      });

      await tx.$executeRaw`
        UPDATE sesion
        SET estado_sesion = 'CERRADA', fecha_cierre = NOW()
        WHERE id_cliente = ${id}::uuid AND estado_sesion = 'ACTIVA'`;

      if (actor) {
        await this.audit.record(
          {
            actorId: actor.id,
            action: 'CLIENTE_BLOQUEAR',
            objectType: 'CLIENTE',
            objectId: id,
            result: 'EXITO',
            before: { estado: cur.estado },
            after: { estado: 'INACTIVO', motivo: reason?.trim() || 'Bloqueo administrativo' },
            ip,
          },
          tx,
        );
      }

      return {
        success: true,
        message: 'Usuario bloqueado exitosamente y sesiones revocadas.',
        userId: id,
        status: 'inactive',
      };
    });
  }

  /**
   * HU19 · SCRUM-85, 87, 88: Desbloqueo de usuarios con reset de contadores de fallo y auditoría.
   */
  async unblockUser(id: string, reason?: string, actor?: AuthUser, ip?: string) {
    if (!UUID_RE.test(id)) throw new NotFoundException('Usuario no encontrado');
    if (actor && actor.id.toLowerCase() === id.toLowerCase()) {
      throw businessError(403, 'SELF_PRIVILEGE_CHANGE', 'No puedes modificar tu propia cuenta.');
    }

    return this.prisma.transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; estado: string; correo: string }[]>`
        SELECT id::text, estado, correo FROM cliente WHERE id = ${id}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Usuario no encontrado');

      const cur = rows[0];
      if (cur.estado === 'ACTIVO') {
        throw businessError(409, 'USER_ALREADY_ACTIVE', 'El usuario ya se encuentra activo.');
      }

      await tx.cliente.update({
        where: { id },
        data: {
          estado: 'ACTIVO',
          intentos_fallidos: 0,
          bloqueo_hasta: null,
          fecha_actualizacion: new Date(),
        },
      });

      if (actor) {
        await this.audit.record(
          {
            actorId: actor.id,
            action: 'CLIENTE_DESBLOQUEAR',
            objectType: 'CLIENTE',
            objectId: id,
            result: 'EXITO',
            before: { estado: cur.estado },
            after: { estado: 'ACTIVO', motivo: reason?.trim() || 'Desbloqueo administrativo' },
            ip,
          },
          tx,
        );
      }

      return {
        success: true,
        message: 'Usuario desbloqueado exitosamente.',
        userId: id,
        status: 'active',
      };
    });
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    const clean = identifier.trim();
    const c = await this.prisma.cliente.findFirst({
      where: { OR: [{ correo: { equals: clean, mode: 'insensitive' } }, { dni: clean }] },
    });
    if (c) return toUser(c);
    return clean.includes('@') ? this.findAdminByEmail(clean) : null;
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<boolean> {
    if (!UUID_RE.test(id)) throw new NotFoundException('Usuario no encontrado');
    try {
      const isAdmin = await this.prisma.admin.findUnique({ where: { id }, select: { id: true } });
      const data = { password_hash: newPasswordHash, fecha_actualizacion: new Date() };
      await this.prisma.transaction(async (tx) => {
        if (isAdmin) await tx.admin.update({ where: { id }, data });
        else await tx.cliente.update({ where: { id }, data });
      });
      return true;
    } catch (e) {
      if (prismaCode(e) === 'P2025') throw new NotFoundException('Usuario no encontrado');
      throw e;
    }
  }

  async remove(id: string): Promise<{ success: boolean }> {
    if (!UUID_RE.test(id)) throw new NotFoundException('Usuario no encontrado');
    try {
      await this.prisma.transaction((tx) => tx.cliente.delete({ where: { id } }));
      return { success: true };
    } catch (e) {
      if (prismaCode(e) === 'P2025') throw new NotFoundException('Usuario no encontrado');
      // FK: el cliente tiene cuentas/operaciones; no se borra (integridad referencial).
      if (prismaCode(e) === 'P2003') {
        throw new ConflictException('No se puede eliminar un cliente con cuentas u operaciones registradas.');
      }
      throw e;
    }
  }
}
