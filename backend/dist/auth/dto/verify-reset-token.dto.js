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
exports.VerifyResetTokenDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class VerifyResetTokenDto {
}
exports.VerifyResetTokenDto = VerifyResetTokenDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Correo electrónico asociado a la solicitud',
        example: 'demo@bankhub.com',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El correo electrónico es obligatorio.' }),
    (0, class_validator_1.IsString)({ message: 'El correo debe ser una cadena válida.' }),
    __metadata("design:type", String)
], VerifyResetTokenDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Código de verificación OTP o token de 6 dígitos',
        example: '839201',
    }),
    (0, class_validator_1.IsNotEmpty)({ message: 'El código de verificación es obligatorio.' }),
    (0, class_validator_1.IsString)({ message: 'El código debe ser una cadena de texto.' }),
    (0, class_validator_1.Length)(6, 64, { message: 'El token/código debe tener entre 6 y 64 caracteres.' }),
    __metadata("design:type", String)
], VerifyResetTokenDto.prototype, "token", void 0);
//# sourceMappingURL=verify-reset-token.dto.js.map