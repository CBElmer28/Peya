import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MovementsService } from './movements.service';
import { MovementsQueryDto } from './dto/movements-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Cuentas Bancarias (Account-Service)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  @ApiOperation({ summary: 'HU08 · Consulta de movimientos con filtros y paginación' })
  async search(@CurrentUser() user: AuthUser, @Query() query: MovementsQueryDto) {
    return this.movementsService.search(user.id, query);
  }
}
