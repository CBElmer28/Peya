"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsService = void 0;
const common_1 = require("@nestjs/common");
const accounts_service_1 = require("../accounts/accounts.service");
let TransactionsService = class TransactionsService {
    constructor(accountsService) {
        this.accountsService = accountsService;
    }
    async processTransfer(dto, idempotencyKey) {
        const sourceAccount = await this.accountsService.getAccountById(dto.sourceAccountId);
        if (!sourceAccount) {
            throw new common_1.NotFoundException('Cuenta de origen no encontrada');
        }
        if (dto.amount > sourceAccount.numericBalance) {
            throw new common_1.UnprocessableEntityException({
                statusCode: 422,
                message: `Fondos insuficientes. Saldo disponible: ${sourceAccount.balance}, Monto solicitado: ${dto.amount}`,
                error: 'INSUFFICIENT_FUNDS',
            });
        }
        const newBalance = await this.accountsService.deductBalance(sourceAccount.id, dto.amount);
        const reference = idempotencyKey
            ? `TRX-${idempotencyKey.slice(0, 8)}`
            : `TRX-${Date.now().toString().slice(-8)}`;
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
};
exports.TransactionsService = TransactionsService;
exports.TransactionsService = TransactionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService])
], TransactionsService);
//# sourceMappingURL=transactions.service.js.map