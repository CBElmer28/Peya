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
exports.ReniecController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reniec_service_1 = require("./reniec.service");
let ReniecController = class ReniecController {
    constructor(reniecService) {
        this.reniecService = reniecService;
    }
    async lookupDni(numero) {
        return this.reniecService.lookupDni(numero);
    }
};
exports.ReniecController = ReniecController;
__decorate([
    (0, common_1.Get)('dni/:numero'),
    (0, swagger_1.ApiOperation)({ summary: 'Consultar información de identidad por número de DNI' }),
    (0, swagger_1.ApiParam)({ name: 'numero', example: '48219032', description: 'DNI de 8 dígitos' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Datos oficiales del ciudadano obtenidos con éxito.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Formato de DNI inválido.' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'El DNI ya se encuentra registrado en el sistema.' }),
    __param(0, (0, common_1.Param)('numero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReniecController.prototype, "lookupDni", null);
exports.ReniecController = ReniecController = __decorate([
    (0, swagger_1.ApiTags)('Identidad & RENIEC (HU1)'),
    (0, common_1.Controller)('reniec'),
    __metadata("design:paramtypes", [reniec_service_1.ReniecService])
], ReniecController);
//# sourceMappingURL=reniec.controller.js.map