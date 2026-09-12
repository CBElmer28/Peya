"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
let UsersService = class UsersService {
    constructor() {
        this.users = [
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
    }
    async register(dto) {
        const cleanDni = dto.dni.trim();
        const cleanEmail = dto.email.trim().toLowerCase();
        const cleanPhone = dto.phone.replace(/\D/g, '').replace(/^51/, '');
        const existingDni = this.users.find((u) => u.dni === cleanDni);
        if (existingDni) {
            throw new common_1.ConflictException({
                statusCode: 409,
                message: 'El DNI ingresado ya se encuentra registrado en BankHub.',
                userName: existingDni.name,
            });
        }
        const existingEmail = this.users.find((u) => u.email.toLowerCase() === cleanEmail);
        if (existingEmail) {
            throw new common_1.ConflictException({
                statusCode: 409,
                message: 'El correo electrónico ya está en uso por otro usuario.',
            });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(dto.password, salt);
        const newUser = {
            id: `usr-${Date.now()}`,
            dni: cleanDni,
            name: dto.name?.trim() || 'Priscilla Fernanda Quispe Torres',
            email: cleanEmail,
            phone: cleanPhone,
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
    async checkDni(dni) {
        const user = this.users.find((u) => u.dni === dni.trim());
        return {
            exists: !!user,
            userName: user?.name,
        };
    }
    async checkEmail(email) {
        const exists = this.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        return { exists };
    }
    async findByEmail(email) {
        return this.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
    }
    async findById(id) {
        return this.users.find((u) => u.id === id) || null;
    }
    async findAll() {
        return this.users.map(({ passwordHash, ...user }) => user);
    }
    async create(dto) {
        const newUser = {
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
    async update(id, dto) {
        const user = this.users.find((u) => u.id === id);
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        if (dto.name)
            user.name = dto.name;
        if (dto.email)
            user.email = dto.email.trim().toLowerCase();
        if (dto.role)
            user.role = dto.role;
        if (dto.status)
            user.status = dto.status;
        const { passwordHash, ...safeUser } = user;
        return safeUser;
    }
    async findByIdentifier(identifier) {
        const clean = identifier.trim().toLowerCase();
        return (this.users.find((u) => u.email.toLowerCase() === clean || u.dni.trim() === identifier.trim()) || null);
    }
    async updatePassword(id, newPasswordHash) {
        const user = this.users.find((u) => u.id === id);
        if (!user)
            throw new common_1.NotFoundException('Usuario no encontrado');
        user.passwordHash = newPasswordHash;
        return true;
    }
    async remove(id) {
        const index = this.users.findIndex((u) => u.id === id);
        if (index === -1)
            throw new common_1.NotFoundException('Usuario no encontrado');
        this.users.splice(index, 1);
        return { success: true };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)()
], UsersService);
//# sourceMappingURL=users.service.js.map