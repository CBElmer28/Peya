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
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const users_service_1 = require("../../users/users.service");
const auth_service_1 = require("../auth.service");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    constructor(usersService, authService) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'BANKHUB_ENTERPRISE_JWT_SECRET_2026',
            passReqToCallback: true,
        });
        this.usersService = usersService;
        this.authService = authService;
    }
    async validate(req, payload) {
        const rawToken = passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (rawToken && this.authService.isTokenRevoked(rawToken)) {
            throw new common_1.UnauthorizedException('El token de sesión ha sido revocado (sesión cerrada). Por favor inicia sesión nuevamente.');
        }
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new common_1.UnauthorizedException('Token inválido o usuario no encontrado.');
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => auth_service_1.AuthService))),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        auth_service_1.AuthService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map