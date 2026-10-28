import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryOperationsDto } from './dto/query-operations.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsGuard, RequirePermissions } from '../access-control/permissions.guard';
import { PERMISSIONS } from '../access-control/permissions';
import { PermissionsService } from '../access-control/permissions.service';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Módulo Administrativo (Admin-Service)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly permissions: PermissionsService,
  ) {}

  /** Roles y permisos efectivos del administrador autenticado, leidos de la BD (para ajustar la interfaz). */
  @Get('access')
  @ApiOperation({ summary: 'Roles y permisos efectivos del administrador autenticado' })
  async getAccess(@CurrentUser() user: AuthUser) {
    const access = await this.permissions.effectiveFor(user.id);
    return { roles: access.roles, permissions: [...access.permissions].sort() };
  }

  @Get('metrics')
  @RequirePermissions(PERMISSIONS.METRICAS_VER)
  @ApiOperation({ summary: 'Obtener métricas agregadas del panel administrativo' })
  @ApiResponse({ status: 200, description: 'Métricas calculadas exitosamente.' })
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('accounts')
  @RequirePermissions(PERMISSIONS.CUENTAS_SUPERVISAR)
  @ApiOperation({ summary: 'Obtener lista de cuentas supervisadas' })
  @ApiResponse({ status: 200, description: 'Cuentas supervisadas devueltas.' })
  async getSupervisedAccounts() {
    return this.adminService.getSupervisedAccounts();
  }

  @Get('operations')
  @RequirePermissions(PERMISSIONS.CUENTAS_SUPERVISAR)
  @ApiOperation({ summary: 'HU18 · Consultar operaciones realizadas con filtros validados y paginación' })
  @ApiResponse({ status: 200, description: 'Operaciones devueltas exitosamente.' })
  async getOperations(@Query() query: QueryOperationsDto) {
    return this.adminService.getOperations(query);
    return this.adminService.getSupervisedAccounts();
  }
}
