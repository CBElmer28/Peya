import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
export declare class AccountsController {
    private readonly accountsService;
    constructor(accountsService: AccountsService);
    getAccounts(): Promise<import("./accounts.service").Account[]>;
    createAccount(dto: CreateAccountDto): Promise<import("./accounts.service").Account>;
    getMovements(): Promise<import("./accounts.service").Movement[]>;
    getNotifications(): Promise<import("./accounts.service").AppNotification[]>;
}
