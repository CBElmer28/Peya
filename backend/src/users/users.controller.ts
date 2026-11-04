import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RegisterDto, CreateUserDto, UpdateUserDto, ChangeStatusDto } from './dto/register.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { PROFILE_EDITABLE_FIELDS, PROTECTED_PROFILE_FIELDS, UpdateProfileDto } from './dto/update-profile.dto';
import { StrictBody, StrictBodyGuard } from '../common/strict-body.guard';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard, RequirePermissions } from '../access-control/permissions.guard';
import { AdminActionInterceptor, AuditAdminAction } from '../access-control/admin-action.interceptor';
import { PERMISSIONS } from '../access-control/permissions';
import { EffectiveAccess } from '../access-control/permissions.service';
import { businessError } from '../common/business-error';

/**
 * Cambiar el rol de una cuenta es un cambio de privilegios: exige gestionar administradores. Nadie puede
 * cambiarse a si mismo el rol ni el estado (evita auto-promocion y auto-reactivacion).
 */
function assertPrivilegeChangeAllowed(
  access: EffectiveAccess,
  actorId: string,
  targetId: string | null,
  change: { role: boolean; status: boolean },
) {
  if ((change.role || change.status) && targetId && targetId.toLowerCase() === actorId.toLowerCase()) {
    throw businessError(403, 'SELF_PRIVILEGE_CHANGE', 'No puedes modificar tus propios privilegios.');
  }
  if (change.role && !access.permissions.has(PERMISSIONS.ADMINS_GESTIONAR)) {
    throw businessError(403, 'PRIVILEGE_ESCALATION', 'No puedes asignar ni modificar privilegios que tú mismo no posees.');
  }
}

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

  // Sin parametro de id: el perfil es siempre el del titular del token (HU14).
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'HU14 · Perfil del usuario autenticado (solo campos autorizados)' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiResponse({ status: 401, description: 'Sin token, token invalido o sesion cerrada.' })
  async me(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }

  // Datos personales solo en el cuerpo (HTTPS), nunca en la URL. Declarada antes de ':id'.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, StrictBodyGuard)
  @StrictBody({ allowed: PROFILE_EDITABLE_FIELDS, protected: PROTECTED_PROFILE_FIELDS })
  @Patch('me')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'HU15 · Actualizar email y/o teléfono del usuario autenticado' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Validación fallida o sin cambios.' })
  @ApiResponse({ status: 403, description: 'Campo no editable o contraseña actual incorrecta.' })
  @ApiResponse({ status: 409, description: 'Correo en uso o perfil modificado por otra sesión.' })
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @RequirePermissions(PERMISSIONS.CLIENTES_VER)
  @Get()
  @ApiOperation({ summary: 'Listar todos los clientes (Módulo Administrativo)' })
  async findAll(@Query() query: QueryUsersDto) {
    if (
      query.page !== undefined ||
      query.pageSize !== undefined ||
      query.q !== undefined ||
      query.status !== undefined ||
      query.role !== undefined
    ) {
      return this.usersService.search(query);
    }
    return this.usersService.findAll();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @RequirePermissions(PERMISSIONS.CLIENTES_VER)
  @Get(':id')
  @ApiOperation({ summary: 'HU17 · Obtener detalle de un cliente con sus cuentas asociadas' })
  async findOne(@Param('id') id: string) {
    return this.usersService.getClientDetail(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @UseInterceptors(AdminActionInterceptor)
  @Roles('admin')
  @RequirePermissions(PERMISSIONS.CLIENTES_GESTIONAR)
  @AuditAdminAction('CLIENTE_CREAR', 'CLIENTE')
  @Post()
  @ApiOperation({ summary: 'Crear cliente desde el panel de administración' })
  async create(@CurrentUser() actor: AuthUser, @Req() req: { access: EffectiveAccess }, @Body() dto: CreateUserDto) {
    assertPrivilegeChangeAllowed(req.access, actor.id, null, { role: dto.role === 'admin', status: false });
    return this.usersService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @UseInterceptors(AdminActionInterceptor)
  @Roles('admin')
  @RequirePermissions(PERMISSIONS.CLIENTES_GESTIONAR)
  @AuditAdminAction('CLIENTE_ACTUALIZAR', 'CLIENTE')
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cliente por ID' })
  async update(
    @CurrentUser() actor: AuthUser,
    @Req() req: { access: EffectiveAccess },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    // El panel reenvia role/status en cada edicion: solo cuenta como cambio de privilegio si difiere del actual.
    const target = await this.usersService.findById(id);
    assertPrivilegeChangeAllowed(req.access, actor.id, id, {
      role: dto.role !== undefined && target?.role !== dto.role,
      status: dto.status !== undefined && target?.status !== dto.status,
    });
    return this.usersService.update(id, dto, actor, (req as any)?.ip);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @UseInterceptors(AdminActionInterceptor)
  @Roles('admin')
  @RequirePermissions(PERMISSIONS.CLIENTES_GESTIONAR)
  @AuditAdminAction('CLIENTE_BLOQUEAR', 'CLIENTE')
  @Post(':id/block')
  @ApiOperation({ summary: 'HU19 · Bloquear usuario cliente y revocar sus sesiones activas' })
  async blockUser(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: any,
  ) {
    return this.usersService.blockUser(id, dto?.reason, actor, req?.ip);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @UseInterceptors(AdminActionInterceptor)
  @Roles('admin')
  @RequirePermissions(PERMISSIONS.CLIENTES_GESTIONAR)
  @AuditAdminAction('CLIENTE_DESBLOQUEAR', 'CLIENTE')
  @Post(':id/unblock')
  @ApiOperation({ summary: 'HU19 · Desbloquear usuario cliente y rehabilitar su acceso' })
  async unblockUser(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: any,
  ) {
    return this.usersService.unblockUser(id, dto?.reason, actor, req?.ip);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @UseInterceptors(AdminActionInterceptor)
  @Roles('admin')
  @RequirePermissions(PERMISSIONS.CLIENTES_GESTIONAR)
  @AuditAdminAction('CLIENTE_ELIMINAR', 'CLIENTE')
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente por ID' })
  async remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    if (id.toLowerCase() === actor.id.toLowerCase()) {
      throw businessError(403, 'SELF_PRIVILEGE_CHANGE', 'No puedes eliminar tu propia cuenta.');
    }
    return this.usersService.remove(id);
  }
}
