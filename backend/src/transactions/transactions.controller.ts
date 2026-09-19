import {
  Controller,
  Post,
  Body,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@ApiTags('Transacciones & Transferencias (Transaction-Service)')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Procesar transferencia bancaria con validación de saldo e idempotencia' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave de idempotencia para prevenir transacciones duplicadas',
  })
  @ApiResponse({ status: 201, description: 'Transferencia completada exitosamente.' })
  @ApiResponse({ status: 422, description: 'Fondos insuficientes (422 Unprocessable Entity).' })
  @ApiResponse({ status: 404, description: 'Cuenta de origen no encontrada.' })
  async createTransfer(
    @Body() dto: CreateTransferDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.transactionsService.processTransfer(dto, idempotencyKey);
  }
}
