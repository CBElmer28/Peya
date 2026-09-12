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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserDto = exports.CreateUserDto = exports.RegisterDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class RegisterDto {
}
exports.RegisterDto = RegisterDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '48219032',
        description: 'DNI del usuario (8 dígitos numéricos peruanos)',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El DNI es obligatorio' }),
    (0, class_validator_1.Length)(8, 8, { message: 'El DNI debe tener exactamente 8 dígitos' }),
    (0, class_validator_1.Matches)(/^\d{8}$/, { message: 'El DNI debe contener solo números' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "dni", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Priscilla Fernanda Quispe Torres',
        required: false,
        description: 'Nombre completo obtenido de RENIEC',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'usuario@bankhub.com',
        description: 'Correo electrónico único del usuario',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El correo electrónico es obligatorio' }),
    (0, class_validator_1.IsEmail)({}, { message: 'El formato de correo electrónico no es válido' }),
    __metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '987654321',
        description: 'Número de celular en Perú (9 dígitos que inician en 9)',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El número de celular es obligatorio' }),
    (0, class_validator_1.Matches)(/^(\+51)?9\d{8}$/, {
        message: 'El teléfono debe ser un celular peruano válido de 9 dígitos comenzando con 9',
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'ClaveSegura123!',
        description: 'Contraseña alfanumérica de al menos 8 caracteres',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La contraseña es obligatoria' }),
    (0, class_validator_1.Length)(8, 64, { message: 'La contraseña debe tener entre 8 y 64 caracteres' }),
    (0, class_validator_1.Matches)(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
        message: 'La contraseña debe incluir letras y números',
    }),
    __metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'data:image/jpeg;base64,...',
        required: false,
        description: 'Foto selfie en formato base64 para verificación KYC',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDto.prototype, "selfieUrl", void 0);
class CreateUserDto {
}
exports.CreateUserDto = CreateUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ana Martínez' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ana.martinez@bankhub.com' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin', enum: ['client', 'admin'] }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "role", void 0);
class UpdateUserDto {
}
exports.UpdateUserDto = UpdateUserDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Ana Martínez', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ana.martinez@bankhub.com', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin', enum: ['client', 'admin'], required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'active', enum: ['active', 'inactive'], required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "status", void 0);
//# sourceMappingURL=register.dto.js.map