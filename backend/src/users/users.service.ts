import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

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
    return c ? toUser(c) : null;
  }

  async findById(id: string): Promise<User | null> {
    if (!UUID_RE.test(id)) return null;
    const c = await this.prisma.cliente.findUnique({ where: { id } });
    return c ? toUser(c) : null;
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
    return c ? toUser(c) : null;
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<boolean> {
    if (!UUID_RE.test(id)) throw new NotFoundException('Usuario no encontrado');
    try {
      await this.prisma.transaction((tx) =>
        tx.cliente.update({
          where: { id },
          data: { password_hash: newPasswordHash, fecha_actualizacion: new Date() },
        }),
      );
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
