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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RegisterDto, CreateUserDto, UpdateUserDto } from './dto/register.dto';

@ApiTags('Users & Registro (HU1)')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Registrar nueva persona natural (HU1 - SCRUM-10/11/12/13)' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente.' })
  @ApiResponse({ status: 409, description: 'DNI o correo electrónico ya registrado.' })
  async register(@Body() dto: RegisterDto) {
    return this.usersService.register(dto);
  }

  @Get('check-dni')
  @ApiOperation({ summary: 'Verificar si un DNI ya se encuentra registrado' })
  @ApiQuery({ name: 'dni', required: true, example: '48219032' })
  async checkDni(@Query('dni') dni: string) {
    return this.usersService.checkDni(dni);
  }

  @Get('check-email')
  @ApiOperation({ summary: 'Verificar si un correo ya se encuentra registrado' })
  @ApiQuery({ name: 'email', required: true, example: 'demo@bankhub.com' })
  async checkEmail(@Query('email') email: string) {
    return this.usersService.checkEmail(email);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los clientes (Módulo Administrativo)' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crear cliente desde el panel de administración' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cliente por ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente por ID' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
