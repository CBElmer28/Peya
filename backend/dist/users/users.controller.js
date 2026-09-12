"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const register_dto_1 = require("./dto/register.dto");
let UsersController = class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    async register(dto) {
        return this.usersService.register(dto);
    }
    async checkDni(dni) {
        return this.usersService.checkDni(dni);
    }
    async checkEmail(email) {
        return this.usersService.checkEmail(email);
    }
    async findAll() {
        return this.usersService.findAll();
    }
    async create(dto) {
        return this.usersService.create(dto);
    }
    async update(id, dto) {
        return this.usersService.update(id, dto);
    }
    async remove(id) {
        return this.usersService.remove(id);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar nueva persona natural (HU1 - SCRUM-10/11/12/13)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Usuario registrado exitosamente.' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'DNI o correo electrónico ya registrado.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('check-dni'),
    (0, swagger_1.ApiOperation)({ summary: 'Verificar si un DNI ya se encuentra registrado' }),
    (0, swagger_1.ApiQuery)({ name: 'dni', required: true, example: '48219032' }),
    __param(0, (0, common_1.Query)('dni')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "checkDni", null);
__decorate([
    (0, common_1.Get)('check-email'),
    (0, swagger_1.ApiOperation)({ summary: 'Verificar si un correo ya se encuentra registrado' }),
    (0, swagger_1.ApiQuery)({ name: 'email', required: true, example: 'demo@bankhub.com' }),
    __param(0, (0, common_1.Query)('email')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "checkEmail", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar todos los clientes (Módulo Administrativo)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear cliente desde el panel de administración' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar cliente por ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, register_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar cliente por ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('Users & Registro (HU1)'),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map