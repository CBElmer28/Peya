import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LEGACY_ADMIN_PERMISSIONS } from './permissions';

export interface EffectiveAccess {
  /** 'admin' = tabla admin; 'legacy' = cliente con rol ADMIN; 'none' = sin acceso administrativo. */
  kind: 'admin' | 'legacy' | 'none';
  roles: string[];
  permissions: Set<string>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permisos efectivos = union de los permisos de los roles ACTIVOS del administrador ACTIVO.
 * Se leen de la BD en cada peticion: un cambio de roles o una baja aplican de inmediato,
 * sin esperar a que expire el JWT, y el token no puede declarar privilegios propios.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async effectiveFor(userId: string): Promise<EffectiveAccess> {
    const none: EffectiveAccess = { kind: 'none', roles: [], permissions: new Set() };
    if (!UUID_RE.test(userId)) return none;

    const admin = await this.prisma.$queryRaw<{ estado: string }[]>`
      SELECT estado FROM admin WHERE id = ${userId}::uuid`;
    if (admin.length) {
      if (admin[0].estado !== 'ACTIVO') return none;
      const rows = await this.prisma.$queryRaw<{ rol: string; codigo: string | null }[]>`
        SELECT r.nombre AS rol, p.codigo
        FROM admin_rol ar
        JOIN rol r ON r.id = ar.id_rol AND r.estado = 'ACTIVO'
        LEFT JOIN rol_permiso rp ON rp.id_rol = r.id
        LEFT JOIN permiso p ON p.id = rp.id_permiso
        WHERE ar.id_admin = ${userId}::uuid`;
      return {
        kind: 'admin',
        roles: [...new Set(rows.map((r) => r.rol))],
        permissions: new Set(rows.map((r) => r.codigo).filter((c): c is string => !!c)),
      };
    }

    const legacy = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM cliente WHERE id = ${userId}::uuid AND rol = 'ADMIN' AND estado = 'ACTIVO'`;
    if (legacy.length) {
      return { kind: 'legacy', roles: [], permissions: new Set<string>(LEGACY_ADMIN_PERMISSIONS) };
    }
    return none;
  }

  /** Roles ACTIVOS por nombre con sus permisos. Los nombres inexistentes simplemente no aparecen. */
  async rolesByName(names: string[]): Promise<Map<string, { id: number; permissions: Set<string> }>> {
    const rows = await this.prisma.$queryRaw<{ id: number; rol: string; codigo: string | null }[]>`
      SELECT r.id::int AS id, r.nombre AS rol, p.codigo
      FROM rol r
      LEFT JOIN rol_permiso rp ON rp.id_rol = r.id
      LEFT JOIN permiso p ON p.id = rp.id_permiso
      WHERE r.estado = 'ACTIVO' AND r.nombre = ANY(${names}::text[])`;
    const out = new Map<string, { id: number; permissions: Set<string> }>();
    for (const row of rows) {
      const entry = out.get(row.rol) ?? { id: row.id, permissions: new Set<string>() };
      if (row.codigo) entry.permissions.add(row.codigo);
      out.set(row.rol, entry);
    }
    return out;
  }
}
