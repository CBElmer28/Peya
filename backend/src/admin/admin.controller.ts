import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Módulo Administrativo (Admin-Service)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Obtener métricas agregadas del panel administrativo' })
  @ApiResponse({ status: 200, description: 'Métricas calculadas exitosamente.' })
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Obtener lista de cuentas supervisadas' })
  @ApiResponse({ status: 200, description: 'Cuentas supervisadas devueltas.' })
  async getSupervisedAccounts() {
    return this.adminService.getSupervisedAccounts();
  }
}
