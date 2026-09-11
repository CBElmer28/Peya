import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

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

@Injectable()
export class UsersService {
  private users: User[] = [
    {
      id: 'usr-1',
      dni: '48219032',
      name: 'Ana Martínez',
      email: 'demo@peya.com',
      phone: '987654321',
      passwordHash: bcrypt.hashSync('123456', 8),
      role: 'admin',
      status: 'active',
      registeredAt: '2024-01-14',
    },
    {
      id: 'usr-demo',
      dni: '48219033',
      name: 'Ana Martínez',
      email: 'demo@bankhub.com',
      phone: '987654321',
      passwordHash: bcrypt.hashSync('123456', 8),
      role: 'admin',
      status: 'active',
      registeredAt: '2024-01-14',
    },
    {
      id: 'usr-2',
      dni: '10203040',
      name: 'Carlos Ruiz',
      email: 'carlos.ruiz@peya.com',
      phone: '987112233',
      passwordHash: bcrypt.hashSync('123456', 8),
      role: 'client',
      status: 'active',
      registeredAt: '2024-02-03',
    },
    {
      id: 'usr-3',
      dni: '70809010',
      name: 'Lucía Fernández',
      email: 'lucia.fernandez@peya.com',
      phone: '987445566',
      passwordHash: bcrypt.hashSync('123456', 8),
      role: 'client',
      status: 'inactive',
      registeredAt: '2024-02-21',
    },
    {
      id: 'usr-4',
      dni: '88888888',
      name: 'Ana Martínez',
      email: 'ana.martinez@peya.com',
      phone: '987778899',
      passwordHash: bcrypt.hashSync('123456', 8),
      role: 'admin',
      status: 'active',
      registeredAt: '2024-04-11',
    },
  ];

  async register(dto: RegisterDto): Promise<{ userId: string; email: string; name: string }> {
    const cleanDni = dto.dni.trim();
    const cleanEmail = dto.email.trim().toLowerCase();

    // Verificación de DNI existente
    const existingDni = this.users.find((u) => u.dni === cleanDni);
    if (existingDni) {
      throw new ConflictException({
        statusCode: 409,
        message: 'El DNI ingresado ya se encuentra registrado en BankHub.',
        userName: existingDni.name,
      });
    }

    // Verificación de Email existente
    const existingEmail = this.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      throw new ConflictException({
        statusCode: 409,
        message: 'El correo electrónico ya está en uso por otro usuario.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const newUser: User = {
      id: `usr-${Date.now()}`,
      dni: cleanDni,
      name: dto.name?.trim() || 'Priscilla Fernanda Quispe Torres',
      email: cleanEmail,
      phone: dto.phone,
      passwordHash,
      role: 'client',
      status: 'active',
      selfieUrl: dto.selfieUrl,
      registeredAt: new Date().toISOString().slice(0, 10),
    };

    this.users.push(newUser);

    return {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
    };
  }

  async checkDni(dni: string): Promise<{ exists: boolean; userName?: string }> {
    const user = this.users.find((u) => u.dni === dni.trim());
    return {
      exists: !!user,
      userName: user?.name,
    };
  }

  async checkEmail(email: string): Promise<{ exists: boolean }> {
    const exists = this.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    return { exists };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.users.map(({ passwordHash, ...user }) => user);
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const newUser: User = {
      id: `usr-${Date.now()}`,
      dni: Math.floor(10000000 + Math.random() * 90000000).toString(),
      name: dto.name,
      email: dto.email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash('123456', 8),
      role: dto.role,
      status: 'active',
      registeredAt: new Date().toISOString().slice(0, 10),
    };
    this.users.push(newUser);
    const { passwordHash, ...user } = newUser;
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (dto.name) user.name = dto.name;
    if (dto.email) user.email = dto.email.trim().toLowerCase();
    if (dto.role) user.role = dto.role;
    if (dto.status) user.status = dto.status;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    const clean = identifier.trim().toLowerCase();
    return (
      this.users.find(
        (u) => u.email.toLowerCase() === clean || u.dni.trim() === identifier.trim(),
      ) || null
    );
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<boolean> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.passwordHash = newPasswordHash;
    return true;
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) throw new NotFoundException('Usuario no encontrado');
    this.users.splice(index, 1);
    return { success: true };
  }
}
