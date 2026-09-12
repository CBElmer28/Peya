import { CreateAccountDto } from './dto/create-account.dto';
export interface Account {
    id: string;
    label: string;
    type: 'savings' | 'checking' | 'usd';
    balance: string;
    numericBalance: number;
    detail: string;
    subtitleDetail: string;
    icon: 'wallet' | 'savings' | 'investment';
    currency: 'PEN' | 'USD';
    cci: string;
    status: 'active' | 'blocked';
    trendLabel: string;
    trendDirection: 'up' | 'down';
}
export interface Movement {
    id: string;
    name: string;
    description: string;
    date: string;
    category: string;
    amount: string;
    type: 'positive' | 'negative';
}
export interface AppNotification {
    id: string;
    title: string;
    detail: string;
    unread: boolean;
    type: 'transfer' | 'login' | 'document' | 'payment' | 'alert' | 'deposit';
}
export declare class AccountsService {
    private accounts;
    private movements;
    private notifications;
    getAccounts(): Promise<Account[]>;
    getAccountById(id: string): Promise<Account>;
    createAccount(dto: CreateAccountDto): Promise<Account>;
    deductBalance(accountId: string, amount: number): Promise<number>;
    getMovements(): Promise<Movement[]>;
    addMovement(movement: Movement): Promise<void>;
    getNotifications(): Promise<AppNotification[]>;
}
