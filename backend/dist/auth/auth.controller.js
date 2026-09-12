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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const forgot_password_dto_1 = require("./dto/forgot-password.dto");
const verify_reset_token_dto_1 = require("./dto/verify-reset-token.dto");
const reset_password_dto_1 = require("./dto/reset-password.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async login(dto) {
        return this.authService.login(dto);
    }
    async logout(authHeader) {
        return this.authService.logout(authHeader);
    }
    async getProfile(req) {
        return req.user;
    }
    async forgotPassword(dto) {
        return this.authService.forgotPassword(dto.identifier);
    }
    async verifyResetToken(dto) {
        return this.authService.verifyResetToken(dto.email, dto.token);
    }
    async resetPassword(dto) {
        return this.authService.resetPassword(dto.email, dto.token, dto.newPassword);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({
        summary: 'Iniciar sesión seguro y generar token JWT (SCRUM-15, 16, 17, 18, 19)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Inicio de sesión exitoso. Retorna token JWT.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Credenciales inválidas (401 Unauthorized).' }),
    (0, swagger_1.ApiResponse)({
        status: 429,
        description: 'Demasiados intentos fallidos (SCRUM-18 - Bloqueo de seguridad por 3 min).',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiHeader)({
        name: 'authorization',
        required: false,
        description: 'Bearer token JWT para invalidación en la lista negra (Blacklist)',
    }),
    (0, swagger_1.ApiOperation)({
        summary: 'Cerrar sesión de forma segura e invalidar token JWT (SCRUM-21, 22, 24, 25)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Sesión invalidada y token revocado con éxito.' }),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Obtener datos del perfil autenticado a través del token JWT (SCRUM-23)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Perfil obtenido exitosamente.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'No autorizado (Token revocado, inválido o expirado).' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({
        summary: 'Solicitar código OTP de recuperación de contraseña por email o DNI (SCRUM-27, 28, 30)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Código de seguridad generado y enviado al correo registrado (Vigencia 15 min).',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forgot_password_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('verify-reset-token'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({
        summary: 'Validar vigencia y autenticidad del código OTP/Token (SCRUM-29, 30, 33)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Código verificado exitosamente.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Código inválido o expirado.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_reset_token_dto_1.VerifyResetTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyResetToken", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({
        summary: 'Restablecer contraseña con validación de fortaleza e invalidación del token (SCRUM-30, 31, 32, 33)',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Contraseña actualizada satisfactoriamente.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Datos inválidos o contraseña demasiado corta.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reset_password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Autenticación, Sesión & Recuperación (HU2, HU3, HU4)'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map