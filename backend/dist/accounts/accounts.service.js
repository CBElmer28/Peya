"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsService = void 0;
const common_1 = require("@nestjs/common");
let AccountsService = class AccountsService {
    constructor() {
        this.accounts = [
            {
                id: 'src-1',
                label: 'Cuenta corriente',
                type: 'checking',
                balance: 'S/. 12,480.50',
                numericBalance: 12480.5,
                detail: 'Disponible para uso inmediato',
                subtitleDetail: 'Sin comisión de mantenimiento',
                icon: 'wallet',
                currency: 'PEN',
                cci: '191-3001234567-89',
                status: 'active',
                trendLabel: '+4.2% respecto al mes pasado',
                trendDirection: 'up',
            },
            {
                id: 'src-2',
                label: 'Ahorros',
                type: 'savings',
                balance: 'S/. 34,120.00',
                numericBalance: 34120.0,
                detail: 'Meta anual · 68% alcanzado',
                subtitleDetail: 'Interés anual: 3.5% TEA',
                icon: 'savings',
                currency: 'PEN',
                cci: '191-3009876543-21',
                status: 'active',
                trendLabel: '+1.8% respecto al mes pasado',
                trendDirection: 'up',
            },
            {
                id: 'src-3',
                label: 'Cuenta en dólares',
                type: 'usd',
                balance: 'USD 8,905.75',
                numericBalance: 8905.75,
                detail: 'Portafolio diversificado',
                subtitleDetail: 'TC referencial: S/. 3.78',
                icon: 'investment',
                currency: 'USD',
                cci: '191-3005647382-10',
                status: 'active',
                trendLabel: '-2.1% respecto al mes pasado',
                trendDirection: 'down',
            },
        ];
        this.movements = [
            {
                id: 'mov-1',
                name: 'Nómina',
                description: 'Depósito de nómina · Banco',
                date: '04/09/2026',
                category: 'Ingreso',
                amount: '+S/. 2,450.00',
                type: 'positive',
            },
            {
                id: 'mov-2',
                name: 'Luz del Sur',
                description: 'Pago de servicios · Luz del Sur',
                date: '03/09/2026',
                category: 'Servicios',
                amount: '-S/. 146.20',
                type: 'negative',
            },
            {
                id: 'mov-3',
                name: 'Amazon.com.pe',
                description: 'Compra online · Amazon.com.pe',
                date: '02/09/2026',
                category: 'Comercio',
                amount: '-S/. 219.90',
                type: 'negative',
            },
            {
                id: 'mov-4',
                name: 'Retiro BCP',
                description: 'Retiro cajero · BCP',
                date: '01/09/2026',
                category: 'Retiro',
                amount: '-S/. 400.00',
                type: 'negative',
            },
        ];
        this.notifications = [
            { id: 'not-1', title: 'Pago recibido de Cliente ACME', detail: 'Hace 10 min', unread: true, type: 'payment' },
            { id: 'not-2', title: 'Recordatorio: factura por vencer', detail: 'Hace 1 hora', unread: false, type: 'alert' },
            { id: 'not-3', title: 'Nuevo dispositivo inició sesión', detail: 'Hace 3 horas', unread: true, type: 'login' },
            { id: 'not-4', title: 'Tu reporte mensual está listo', detail: 'Ayer', unread: false, type: 'document' },
        ];
    }
    async getAccounts() {
        return this.accounts;
    }
    async getAccountById(id) {
        const acc = this.accounts.find((a) => a.id === id);
        if (!acc)
            throw new common_1.NotFoundException('Cuenta no encontrada');
        return acc;
    }
    async createAccount(dto) {
        const id = `acc-${Date.now().toString().slice(-8)}`;
        const label = dto.type === 'savings'
            ? 'Ahorros'
            : dto.type === 'checking'
                ? 'Cuenta corriente'
                : 'Cuenta en dólares';
        const subtitleDetail = dto.type === 'savings'
            ? 'Interés anual: 3.5% TEA'
            : dto.type === 'checking'
                ? 'Sin comisión de mantenimiento'
                : 'TC referencial: S/. 3.78';
        const icon = dto.type === 'savings' ? 'savings' : dto.type === 'checking' ? 'wallet' : 'investment';
        const digits = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('');
        const cci = `191-${digits.slice(0, 4)}${digits.slice(4, 8)}${digits.slice(8, 12)}-${digits.slice(12, 15)}`;
        const newAcc = {
            id,
            label,
            type: dto.type,
            balance: dto.currency === 'PEN' ? 'S/. 0.00' : 'USD 0.00',
            numericBalance: 0,
            detail: 'Cuenta recién abierta',
            subtitleDetail,
            icon,
            currency: dto.currency,
            cci,
            status: 'active',
            trendLabel: '0.0% este mes',
            trendDirection: 'up',
        };
        this.accounts.push(newAcc);
        return newAcc;
    }
    async deductBalance(accountId, amount) {
        const acc = await this.getAccountById(accountId);
        acc.numericBalance -= amount;
        const formatted = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(acc.numericBalance);
        acc.balance = acc.currency === 'PEN' ? `S/. ${formatted}` : `USD ${formatted}`;
        return acc.numericBalance;
    }
    async getMovements() {
        return this.movements;
    }
    async addMovement(movement) {
        this.movements.unshift(movement);
    }
    async getNotifications() {
        return this.notifications;
    }
};
exports.AccountsService = AccountsService;
exports.AccountsService = AccountsService = __decorate([
    (0, common_1.Injectable)()
], AccountsService);
//# sourceMappingURL=accounts.service.js.map