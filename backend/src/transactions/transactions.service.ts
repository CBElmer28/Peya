import {
  Injectable,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { AccountsService } from '../accounts/accounts.service';

export interface TransferResult {
  status: 'success';
  reference: string;
  newBalance: number;
  transferredAt: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly accountsService: AccountsService) {}

  async processTransfer(dto: CreateTransferDto, idempotencyKey?: string): Promise<TransferResult> {
    const sourceAccount = await this.accountsService.getAccountById(dto.sourceAccountId);

    if (!sourceAccount) {
      throw new NotFoundException('Cuenta de origen no encontrada');
    }

    // Validación de saldo disponible en el Backend (HTTP 422 si fondos insuficientes)
    if (dto.amount > sourceAccount.numericBalance) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: `Fondos insuficientes. Saldo disponible: ${sourceAccount.balance}, Monto solicitado: ${dto.amount}`,
        error: 'INSUFFICIENT_FUNDS',
      });
    }

    // Débito atómico
    const newBalance = await this.accountsService.deductBalance(sourceAccount.id, dto.amount);

    const reference = idempotencyKey
      ? `TRX-${idempotencyKey.slice(0, 8)}`
      : `TRX-${Date.now().toString().slice(-8)}`;

    // Registrar en el historial de movimientos
    await this.accountsService.addMovement({
      id: `mov-${Date.now()}`,
      name: dto.description || 'Transferencia enviada',
      description: `Operación ${reference} · ${sourceAccount.label}`,
      date: new Date().toLocaleDateString('es-PE'),
      category: 'Transferencia',
      amount: `-${sourceAccount.currency === 'PEN' ? 'S/.' : 'USD'} ${dto.amount.toFixed(2)}`,
      type: 'negative',
    });

    return {
      status: 'success',
      reference,
      newBalance,
      transferredAt: new Date().toISOString(),
    };
  }
}
