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
exports.ResetPasswordDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ResetPasswordDto {
}
exports.ResetPasswordDto = ResetPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Correo electrónico asociado',
        example: 'demo@bankhub.com',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El correo electrónico es obligatorio.' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código de recuperación verificado',
        example: '839201',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El token/código de recuperación es obligatorio.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 64),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "token", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Nueva contraseña segura (mínimo 6 caracteres)',
        example: 'BankHubSecure2026!',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La nueva contraseña no puede estar vacía.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres.' }),
    __metadata("design:type", String)
], ResetPasswordDto.prototype, "newPassword", void 0);
//# sourceMappingURL=reset-password.dto.js.map