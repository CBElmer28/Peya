import { UsersService } from './users.service';
import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
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
    findAll(): Promise<Omit<import("./users.service").User, "passwordHash">[]>;
    create(dto: CreateUserDto): Promise<Omit<import("./users.service").User, "passwordHash">>;
    update(id: string, dto: UpdateUserDto): Promise<Omit<import("./users.service").User, "passwordHash">>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
