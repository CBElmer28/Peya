import { CreateTransferDto } from './dto/create-transfer.dto';
import { AccountsService } from '../accounts/accounts.service';
export interface TransferResult {
    status: 'success';
    reference: string;
    newBalance: number;
    transferredAt: string;
}
export declare class TransactionsService {
    private readonly accountsService;
    constructor(accountsService: AccountsService);
    processTransfer(dto: CreateTransferDto, idempotencyKey?: string): Promise<TransferResult>;
}
