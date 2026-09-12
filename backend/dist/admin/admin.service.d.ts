import { UsersService } from '../users/users.service';
import { AccountsService } from '../accounts/accounts.service';
export interface AdminMetric {
    id: string;
    label: string;
    value: string;
    growth: string;
    trend: 'up' | 'down';
}
export interface SupervisedAccount {
    id: string;
    client: string;
    number: string;
    type: 'Corriente' | 'Ahorros' | 'Inversión';
    balance: string;
    status: 'active' | 'blocked';
    recent: boolean;
}
export declare class AdminService {
    private readonly usersService;
    private readonly accountsService;
    constructor(usersService: UsersService, accountsService: AccountsService);
    getMetrics(): Promise<AdminMetric[]>;
    getSupervisedAccounts(): Promise<SupervisedAccount[]>;
}
