export declare class RegisterDto {
    dni: string;
    name?: string;
    email: string;
    phone: string;
    password: string;
    selfieUrl?: string;
}
export declare class CreateUserDto {
    name: string;
    email: string;
    role: 'client' | 'admin';
}
export declare class UpdateUserDto {
    name?: string;
    email?: string;
    role?: 'client' | 'admin';
    status?: 'active' | 'inactive';
}
