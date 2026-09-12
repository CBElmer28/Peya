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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_service_1 = require("./admin.service");
let AdminController = class AdminController {
    constructor(adminService) {
        this.adminService = adminService;
    }
    async getMetrics() {
        return this.adminService.getMetrics();
    }
    async getSupervisedAccounts() {
        return this.adminService.getSupervisedAccounts();
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('metrics'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener métricas agregadas del panel administrativo' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Métricas calculadas exitosamente.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getMetrics", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener lista de cuentas supervisadas' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Cuentas supervisadas devueltas.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSupervisedAccounts", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('Módulo Administrativo (Admin-Service)'),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map