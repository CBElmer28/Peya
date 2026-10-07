import { Body, Controller, DefaultValuePipe, Get, Header, Headers, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransferDto, InternalTransferDto, ThirdPartyTransferDto } from './dto/create-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { businessError } from '../common/business-error';

const IDEM = {
  name: 'Idempotency-Key',
  required: true,
  description: 'Clave única por intento de usuario; reintentos con la misma clave no duplican la operación',
};

@ApiTags('Transacciones & Transferencias (Transaction-Service)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Contrato previo: transferencia interna o a terceros según transactionType' })
  @ApiHeader(IDEM)
  @ApiResponse({ status: 201, description: 'Transferencia completada.' })
  @ApiResponse({ status: 422, description: 'Regla de negocio incumplida (p. ej. INSUFFICIENT_FUNDS).' })
  async createTransfer(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTransferDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.transactionsService.processTransfer(user, dto, idempotencyKey);
  }

  @Post('internal')
  @ApiOperation({ summary: 'HU09 · Transferencia entre cuentas propias' })
  @ApiHeader(IDEM)
  async internal(
    @CurrentUser() user: AuthUser,
    @Body() dto: InternalTransferDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.transactionsService.internalTransfer(user, dto, idempotencyKey);
  }

  @Post('third-party')
  @ApiOperation({ summary: 'HU10 · Transferencia a otro cliente (por CCI)' })
  @ApiHeader(IDEM)
  async thirdParty(
    @CurrentUser() user: AuthUser,
    @Body() dto: ThirdPartyTransferDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.transactionsService.thirdPartyTransfer(user, dto, idempotencyKey);
  }

  @Get('third-party/validate')
  @ApiOperation({ summary: 'HU10 · Validar CCI destino (devuelve titular parcialmente enmascarado)' })
  @ApiQuery({ name: 'cci', required: true })
  async validate(@CurrentUser() user: AuthUser, @Query('cci') cci: string) {
    if (!cci || !/^[0-9-]{10,25}$/.test(cci)) throw businessError(400, 'INVALID_CCI', 'CCI inválido.');
    return this.transactionsService.validateDestination(user, cci);
  }

  @Get('recent-recipients')
  @ApiOperation({ summary: 'HU11 · Destinatarios recientes del cliente autenticado' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máx. 20 (por defecto 5)' })
  @ApiQuery({ name: 'page', required: false })
  async recent(
    @CurrentUser() user: AuthUser,
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.transactionsService.recentRecipients(user.id, Math.min(Math.max(limit, 1), 20), Math.max(page, 1));
  }

  @Get(':id/receipt')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'HU12 · Constancia de una transferencia propia' })
  @ApiResponse({ status: 404, description: 'Transferencia inexistente o de otro cliente.' })
  async receipt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.transactionsService.receipt(user.id, id);
  }
}
