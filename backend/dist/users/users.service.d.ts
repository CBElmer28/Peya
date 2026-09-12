import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';
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
export declare class UsersService {
    private users;
    register(dto: RegisterDto): Promise<{
        userId: string;
        email: string;
        name: string;
    }>;
    checkDni(dni: string): Promise<{
        exists: boolean;
        userName?: string;
    }>;
    checkEmail(email: string): Promise<{
        exists: boolean;
    }>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findAll(): Promise<Omit<User, 'passwordHash'>[]>;
    create(dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>>;
    update(id: string, dto: UpdateUserDto): Promise<Omit<User, 'passwordHash'>>;
    findByIdentifier(identifier: string): Promise<User | null>;
    updatePassword(id: string, newPasswordHash: string): Promise<boolean>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
