import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { MovementsService } from './movements.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { MovementsQueryDto, PageQueryDto } from './dto/movements-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Cuentas Bancarias (Account-Service)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly movementsService: MovementsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'HU06 · Cuentas y saldos del cliente autenticado' })
  async getAccounts(@CurrentUser() user: AuthUser) {
    return this.accountsService.getAccounts(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'HU05 · Abrir una nueva cuenta bancaria' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Evita aperturas duplicadas por reintentos' })
  @ApiResponse({ status: 201, description: 'Cuenta creada con éxito (o respuesta original si es un reintento).' })
  @ApiResponse({ status: 422, description: 'Regla de negocio incumplida.' })
  async createAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAccountDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.accountsService.createAccount(user, dto, idempotencyKey);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Movimientos recientes del cliente (contrato previo, lista simple)' })
  async getMovements(@CurrentUser() user: AuthUser) {
    return this.movementsService.getLegacyMovements(user.id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Obtener las notificaciones del usuario' })
  async getNotifications() {
    return this.accountsService.getNotifications();
  }

  @Get(':id')
  @ApiOperation({ summary: 'HU07 · Detalle de una cuenta propia con movimientos paginados' })
  @ApiResponse({ status: 404, description: 'Cuenta inexistente o que no pertenece al cliente.' })
  async getAccountDetail(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() query: PageQueryDto) {
    const account = await this.accountsService.getOwnedAccount(user.id, id);
    const movements = await this.movementsService.listForAccount(user.id, id, query);
    return { account, movements };
  }
}
