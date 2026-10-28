import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RechargeAccountDto {
  @ApiProperty({
    example: 150.0,
    description: 'Monto a recargar en la cuenta (simulación de depósito en cajero/ventanilla)',
  })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe tener como máximo 2 decimales' })
  @IsPositive({ message: 'El monto debe ser positivo mayor a cero' })
  @Min(1, { message: 'El monto mínimo de recarga es 1.00' })
  @Max(20000, { message: 'El monto máximo permitido por recarga es 20,000.00' })
  amount: number;

  @ApiPropertyOptional({
    example: 'Depósito en cajero automático BankHub',
    description: 'Descripción o motivo de la recarga',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '191-1234567890-12',
    description: 'CCI de la cuenta de destino (requerido si no se especifica el ID en la URL)',
  })
  @IsOptional()
  @IsString()
  cci?: string;
}
