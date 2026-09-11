import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'BANKHUB_ENTERPRISE_JWT_SECRET_2026',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: { sub: string; email: string; name: string; role: string }) {
    // 1. Validar que el token no haya sido revocado en el logout (SCRUM-22 / SCRUM-25)
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (rawToken && this.authService.isTokenRevoked(rawToken)) {
      throw new UnauthorizedException(
        'El token de sesión ha sido revocado (sesión cerrada). Por favor inicia sesión nuevamente.',
      );
    }

    // 2. Validar que el usuario exista y esté activo
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Token inválido o usuario no encontrado.');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
