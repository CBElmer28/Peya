import { TransactionsService } from './transactions.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
export declare class TransactionsController {
    private readonly transactionsService;
    constructor(transactionsService: TransactionsService);
    createTransfer(dto: CreateTransferDto, idempotencyKey?: string): Promise<import("./transactions.service").TransferResult>;
}
