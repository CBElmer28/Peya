import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';
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
  constructor(private readonly prisma: PrismaService) {}

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
   * HU15: actualiza email y/o telefono del titular del token. Todo ocurre en UNA transaccion con la fila
   * bloqueada (FOR UPDATE): las validaciones y el UPDATE ven el mismo estado, y si algo falla no se
   * persiste nada. expectedUpdatedAt permite detectar que otra sesion modifico el perfil entretanto.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    if (!UUID_RE.test(userId)) throw new NotFoundException('Perfil no encontrado');
    const wantsEmail = dto.email !== undefined;
    const wantsPhone = dto.phone !== undefined;
    if (!wantsEmail && !wantsPhone) {
      throw businessError(400, 'NO_CHANGES', 'Indica al menos un campo a actualizar (email o phone).');
    }
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.replace(/\D/g, '').replace(/^51/, '');

    type Row = { correo: string; telefono: string | null; password_hash: string; estado: string; fecha_actualizacion: Date };
    try {
      await this.prisma.transaction(async (tx) => {
        let kind: 'cliente' | 'admin' = 'cliente';
        let rows = await tx.$queryRaw<Row[]>`
          SELECT correo, telefono, password_hash, estado, fecha_actualizacion
          FROM cliente WHERE id = ${userId}::uuid FOR UPDATE`;
        if (!rows.length) {
          kind = 'admin';
          rows = await tx.$queryRaw<Row[]>`
            SELECT correo, NULL::text AS telefono, password_hash, estado, fecha_actualizacion
            FROM admin WHERE id = ${userId}::uuid FOR UPDATE`;
        }
        const cur = rows[0];
        if (!cur || cur.estado !== 'ACTIVO') throw new NotFoundException('Perfil no encontrado');

        if (kind === 'admin' && wantsPhone) {
          throw businessError(403, 'FIELD_NOT_EDITABLE', 'El campo "phone" no está disponible para administradores.');
        }
        if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== cur.fecha_actualizacion.getTime()) {
          throw businessError(
            409,
            'PROFILE_CONFLICT',
            'Tu perfil fue modificado desde otra sesión. Vuelve a cargarlo e inténtalo de nuevo.',
          );
        }

        const emailChanged = wantsEmail && email !== cur.correo.toLowerCase();
        const phoneChanged = wantsPhone && phone !== (cur.telefono ?? null);
        if (!emailChanged && !phoneChanged) {
          throw businessError(400, 'NO_CHANGES', 'Los datos enviados son iguales a los actuales.');
        }

        if (emailChanged) {
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
        }

        const now = new Date();
        if (kind === 'cliente') {
          await tx.cliente.update({
            where: { id: userId },
            data: {
              ...(emailChanged ? { correo: email } : {}),
              ...(phoneChanged ? { telefono: phone } : {}),
              fecha_actualizacion: now,
            },
          });
        } else {
          await tx.admin.update({
            where: { id: userId },
            data: { ...(emailChanged ? { correo: email } : {}), fecha_actualizacion: now },
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

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    if (!UUID_RE.test(id)) throw new NotFoundException('Usuario no encontrado');
    const data: Prisma.clienteUpdateInput = { fecha_actualizacion: new Date() };
    if (dto.name) data.nombres = dto.name;
    if (dto.email) data.correo = dto.email.trim().toLowerCase();
    if (dto.role) data.rol = dto.role === 'admin' ? 'ADMIN' : 'CLIENTE';
    if (dto.status) data.estado = dto.status === 'active' ? 'ACTIVO' : 'INACTIVO';
    try {
      const c = await this.prisma.transaction((tx) => tx.cliente.update({ where: { id }, data }));
      const { passwordHash, selfieUrl, ...safe } = toUser(c);
      return safe;
    } catch (e) {
      if (prismaCode(e) === 'P2025') throw new NotFoundException('Usuario no encontrado');
      if (prismaCode(e) === 'P2002') throw new ConflictException('El correo electrónico ya está en uso.');
      throw e;
    }
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
