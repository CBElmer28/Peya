import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('Módulo Administrativo (Admin-Service)')
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
