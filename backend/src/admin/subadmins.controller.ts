import { Body, Controller, Get, Ip, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubadminsService } from './subadmins.service';
import { CreateSubadminDto, RolesDto } from './dto/subadmin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard, RequirePermissions } from '../access-control/permissions.guard';
import { PERMISSIONS } from '../access-control/permissions';
import { StrictBody, StrictBodyGuard } from '../common/strict-body.guard';

@ApiTags('Subadministradores (HU16)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, StrictBodyGuard)
@Roles('admin')
@RequirePermissions(PERMISSIONS.ADMINS_GESTIONAR)
@Controller('admin/subadmins')
export class SubadminsController {
  constructor(private readonly service: SubadminsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar administradores con sus roles y permisos efectivos' })
  list() {
    return this.service.list();
  }

  @Post()
  // Campos desconocidos (p. ej. "permissions") se rechazan con 400: los privilegios solo se asignan por rol.
  @StrictBody({ allowed: ['name', 'email', 'password', 'roles'] })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'HU16 · Registrar un subadministrador con roles autorizados' })
  @ApiResponse({ status: 201, description: 'Subadministrador creado.' })
  @ApiResponse({ status: 403, description: 'Sin permiso o intento de asignar privilegios que el actor no posee.' })
  @ApiResponse({ status: 409, description: 'Correo ya registrado.' })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateSubadminDto, @Ip() ip: string) {
    return this.service.create(actor, dto, ip);
  }

  @Patch(':id/roles')
  @StrictBody({ allowed: ['roles'] })
  @ApiOperation({ summary: 'Reemplazar los roles de un administrador (nunca los propios)' })
  @ApiResponse({ status: 403, description: 'Auto-modificacion o escalada de privilegios.' })
  changeRoles(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: RolesDto,
    @Ip() ip: string,
  ) {
    return this.service.changeRoles(actor, id, dto.roles, ip);
  }
}
