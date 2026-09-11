import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString, IsOptional } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({
    example: 'third-party',
    enum: ['internal', 'third-party', 'service'],
    description: 'Tipo de operación transaccional',
  })
  @IsNotEmpty()
  @IsString()
  transactionType: string;

  @ApiProperty({
    example: 'src-1',
    description: 'ID de la cuenta de origen de los fondos',
  })
  @IsNotEmpty()
  @IsString()
  sourceAccountId: string;

  @ApiProperty({
    example: '191-4567890123-45',
    description: 'Cuenta o CCI de destino',
  })
  @IsNotEmpty()
  @IsString()
  destinationAccount: string;

  @ApiProperty({
    example: 150.0,
    description: 'Monto a transferir (debe ser mayor a 0)',
  })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive({ message: 'El monto debe ser un valor positivo' })
  amount: number;

  @ApiProperty({
    example: 'Pago de servicios de consultoría',
    required: false,
    description: 'Descripción o concepto de la transferencia',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
