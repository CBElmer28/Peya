import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Autenticación & Sesión (HU2 - SCRUM-15/16/17/18)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Iniciar sesión seguro y generar token JWT (SCRUM-15, 16, 17, 18)' })
  @ApiResponse({ status: 200, description: 'Inicio de sesión exitoso. Retorna token JWT.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas (401 Unauthorized).' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos fallidos (SCRUM-18 - Bloqueo de seguridad).' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado a través del token JWT' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado (Token inválido o expirado).' })
  async getProfile(@Request() req: any) {
    return req.user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión (HU3)' })
  @ApiResponse({ status: 200, description: 'Sesión invalidada.' })
  async logout() {
    return { success: true, message: 'Sesión cerrada satisfactoriamente.' };
  }
}
