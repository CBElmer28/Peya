import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';

@ApiTags('Users & Registro (HU1)')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Registrar nueva persona natural (HU1 - SCRUM-10/11/12/13)' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente.' })
  @ApiResponse({ status: 409, description: 'DNI o correo electrónico ya registrado.' })
  async register(@Body() dto: RegisterDto) {
    return this.usersService.register(dto);
  }

  @Get('check-dni')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Verificar si un DNI ya se encuentra registrado' })
  @ApiQuery({ name: 'dni', required: true, example: '48219032' })
  async checkDni(@Query('dni') dni: string) {
    return this.usersService.checkDni(dni);
  }

  @Get('check-email')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Verificar si un correo ya se encuentra registrado' })
  @ApiQuery({ name: 'email', required: true, example: 'demo@bankhub.com' })
  async checkEmail(@Query('email') email: string) {
    return this.usersService.checkEmail(email);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  @ApiOperation({ summary: 'Listar todos los clientes (Módulo Administrativo)' })
  async findAll() {
    return this.usersService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @ApiOperation({ summary: 'Crear cliente desde el panel de administración' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cliente por ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente por ID' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
