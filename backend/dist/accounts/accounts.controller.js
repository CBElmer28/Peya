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
exports.AccountsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const accounts_service_1 = require("./accounts.service");
const create_account_dto_1 = require("./dto/create-account.dto");
let AccountsController = class AccountsController {
    constructor(accountsService) {
        this.accountsService = accountsService;
    }
    async getAccounts() {
        return this.accountsService.getAccounts();
    }
    async createAccount(dto) {
        return this.accountsService.createAccount(dto);
    }
    async getMovements() {
        return this.accountsService.getMovements();
    }
    async getNotifications() {
        return this.accountsService.getNotifications();
    }
};
exports.AccountsController = AccountsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener todas las cuentas bancarias del usuario' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AccountsController.prototype, "getAccounts", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Abrir una nueva cuenta bancaria' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Cuenta creada con éxito.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_account_dto_1.CreateAccountDto]),
    __metadata("design:returntype", Promise)
], AccountsController.prototype, "createAccount", null);
__decorate([
    (0, common_1.Get)('movements'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener el historial reciente de movimientos' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AccountsController.prototype, "getMovements", null);
__decorate([
    (0, common_1.Get)('notifications'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener las notificaciones del usuario' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AccountsController.prototype, "getNotifications", null);
exports.AccountsController = AccountsController = __decorate([
    (0, swagger_1.ApiTags)('Cuentas Bancarias (Account-Service)'),
    (0, common_1.Controller)('accounts'),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService])
], AccountsController);
//# sourceMappingURL=accounts.controller.js.map