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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const transactions_service_1 = require("./transactions.service");
const create_transfer_dto_1 = require("./dto/create-transfer.dto");
let TransactionsController = class TransactionsController {
    constructor(transactionsService) {
        this.transactionsService = transactionsService;
    }
    async createTransfer(dto, idempotencyKey) {
        return this.transactionsService.processTransfer(dto, idempotencyKey);
    }
};
exports.TransactionsController = TransactionsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Procesar transferencia bancaria con validación de saldo e idempotencia' }),
    (0, swagger_1.ApiHeader)({
        name: 'Idempotency-Key',
        required: false,
        description: 'Clave de idempotencia para prevenir transacciones duplicadas',
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Transferencia completada exitosamente.' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Fondos insuficientes (422 Unprocessable Entity).' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Cuenta de origen no encontrada.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('Idempotency-Key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_transfer_dto_1.CreateTransferDto, String]),
    __metadata("design:returntype", Promise)
], TransactionsController.prototype, "createTransfer", null);
exports.TransactionsController = TransactionsController = __decorate([
    (0, swagger_1.ApiTags)('Transacciones & Transferencias (Transaction-Service)'),
    (0, common_1.Controller)('transactions'),
    __metadata("design:paramtypes", [transactions_service_1.TransactionsService])
], TransactionsController);
//# sourceMappingURL=transactions.controller.js.map