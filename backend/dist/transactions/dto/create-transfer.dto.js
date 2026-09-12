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
exports.CreateTransferDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateTransferDto {
}
exports.CreateTransferDto = CreateTransferDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'third-party',
        enum: ['internal', 'third-party', 'service'],
        description: 'Tipo de operación transaccional',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransferDto.prototype, "transactionType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'src-1',
        description: 'ID de la cuenta de origen de los fondos',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransferDto.prototype, "sourceAccountId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '191-4567890123-45',
        description: 'Cuenta o CCI de destino',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransferDto.prototype, "destinationAccount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 150.0,
        description: 'Monto a transferir (debe ser mayor a 0)',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsPositive)({ message: 'El monto debe ser un valor positivo' }),
    __metadata("design:type", Number)
], CreateTransferDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'Pago de servicios de consultoría',
        required: false,
        description: 'Descripción o concepto de la transferencia',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateTransferDto.prototype, "description", void 0);
//# sourceMappingURL=create-transfer.dto.js.map