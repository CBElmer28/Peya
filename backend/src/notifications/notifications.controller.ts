import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PageQueryDto } from '../accounts/dto/movements-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notificaciones (HU13)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'HU13 · Notificaciones del cliente autenticado (mas recientes primero)' })
  list(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.service.list(user.id, query);
  }

  // Rutas fijas antes de ':id' para que no se interpreten como identificador.
  @Patch('read-all')
  @ApiOperation({ summary: 'Marca como leidas todas las notificaciones propias' })
  readAll(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'HU13 · Detalle de una notificacion propia con los datos de la transferencia' })
  @ApiResponse({ status: 404, description: 'Inexistente o de otro cliente.' })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getOwned(user.id, id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca como leida una notificacion propia' })
  @ApiResponse({ status: 404, description: 'Inexistente o de otro cliente.' })
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }
}
