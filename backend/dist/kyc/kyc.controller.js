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
exports.KycController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const kyc_service_1 = require("./kyc.service");
const verify_face_dto_1 = require("./dto/verify-face.dto");
let KycController = class KycController {
    constructor(kycService) {
        this.kycService = kycService;
    }
    async verifyFace(dto) {
        return this.kycService.verifyFace(dto);
    }
};
exports.KycController = KycController;
__decorate([
    (0, common_1.Post)('verify-face'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Verificación biométrica facial (KYC)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Rostro verificado y comparado satisfactoriamente.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Imagen selfie inválida.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_face_dto_1.VerifyFaceDto]),
    __metadata("design:returntype", Promise)
], KycController.prototype, "verifyFace", null);
exports.KycController = KycController = __decorate([
    (0, swagger_1.ApiTags)('Biometría & KYC (HU1)'),
    (0, common_1.Controller)('kyc'),
    __metadata("design:paramtypes", [kyc_service_1.KycService])
], KycController);
//# sourceMappingURL=kyc.controller.js.map