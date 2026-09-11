import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Headers,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetTokenDto } from './dto/verify-reset-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Autenticación, Sesión & Recuperación (HU2, HU3, HU4)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==========================================
  // HU2 - INICIO DE SESIÓN SEGURO (SCRUM-14)
  // ==========================================
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Iniciar sesión seguro y generar token JWT (SCRUM-15, 16, 17, 18, 19)',
  })
  @ApiResponse({ status: 200, description: 'Inicio de sesión exitoso. Retorna token JWT.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas (401 Unauthorized).' })
  @ApiResponse({
    status: 429,
    description: 'Demasiados intentos fallidos (SCRUM-18 - Bloqueo de seguridad por 3 min).',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ==========================================
  // HU3 - CIERRE DE SESIÓN SEGURO (SCRUM-20)
  // ==========================================
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'authorization',
    required: false,
    description: 'Bearer token JWT para invalidación en la lista negra (Blacklist)',
  })
  @ApiOperation({
    summary: 'Cerrar sesión de forma segura e invalidar token JWT (SCRUM-21, 22, 24, 25)',
  })
  @ApiResponse({ status: 200, description: 'Sesión invalidada y token revocado con éxito.' })
  async logout(@Headers('authorization') authHeader?: string) {
    return this.authService.logout(authHeader);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener datos del perfil autenticado a través del token JWT (SCRUM-23)',
  })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado (Token revocado, inválido o expirado).' })
  async getProfile(@Request() req: any) {
    return req.user;
  }

  // ==========================================
  // HU4 - RECUPERACIÓN SEGURA DE CONTRASEÑA (SCRUM-26)
  // ==========================================
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary:
      'Solicitar código OTP de recuperación de contraseña por email o DNI (SCRUM-27, 28, 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Código de seguridad generado y enviado al correo registrado (Vigencia 15 min).',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.identifier);
  }

  @Post('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Validar vigencia y autenticidad del código OTP/Token (SCRUM-29, 30, 33)',
  })
  @ApiResponse({ status: 200, description: 'Código verificado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado.' })
  async verifyResetToken(@Body() dto: VerifyResetTokenDto) {
    return this.authService.verifyResetToken(dto.email, dto.token);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary:
      'Restablecer contraseña con validación de fortaleza e invalidación del token (SCRUM-30, 31, 32, 33)',
  })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada satisfactoriamente.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o contraseña demasiado corta.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.token, dto.newPassword);
  }
}
