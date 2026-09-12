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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("../users/users.service");
const accounts_service_1 = require("../accounts/accounts.service");
let AdminService = class AdminService {
    constructor(usersService, accountsService) {
        this.usersService = usersService;
        this.accountsService = accountsService;
    }
    async getMetrics() {
        const users = await this.usersService.findAll();
        const activeClients = users.filter((u) => u.status === 'active' && u.role === 'client');
        const accounts = await this.accountsService.getAccounts();
        const totalClientsCount = users.length;
        return [
            {
                id: 'm1',
                label: 'Total clientes activos',
                value: activeClients.length.toLocaleString('es-PE'),
                growth: '+8.2%',
                trend: 'up',
            },
            {
                id: 'm2',
                label: 'Cuentas creadas',
                value: (accounts.length + totalClientsCount * 2).toLocaleString('es-PE'),
                growth: '+3.1%',
                trend: 'up',
            },
            {
                id: 'm3',
                label: 'Volumen total transaccionado',
                value: '$4.8M',
                growth: '+5.4%',
                trend: 'up',
            },
        ];
    }
    async getSupervisedAccounts() {
        const users = await this.usersService.findAll();
        const accounts = await this.accountsService.getAccounts();
        const supervised = [];
        users.forEach((user, index) => {
            const isBlocked = user.status === 'inactive';
            const lastDigits = user.dni ? user.dni.slice(-4) : `${1000 + index}`;
            const type = index % 3 === 0 ? 'Corriente' : index % 3 === 1 ? 'Ahorros' : 'Inversión';
            const balance = index === 0
                ? 'S/. 12,480.50'
                : index === 1
                    ? 'S/. 34,120.00'
                    : index === 2
                        ? 'USD 8,905.75'
                        : `S/. ${(1500 + index * 430).toFixed(2)}`;
            supervised.push({
                id: `sup-${user.id}`,
                client: user.name,
                number: `**** ${lastDigits}`,
                type,
                balance,
                status: isBlocked ? 'blocked' : 'active',
                recent: index % 2 === 0,
            });
        });
        return supervised;
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        accounts_service_1.AccountsService])
], AdminService);
//# sourceMappingURL=admin.service.js.map