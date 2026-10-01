import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
} from 'class-validator';

const AMOUNT_MSG = 'El monto debe ser un valor positivo con máximo 2 decimales';

/** HU09: transferencia entre cuentas propias. */
export class InternalTransferDto {
  @ApiProperty({ description: 'ID de la cuenta origen (debe ser del cliente autenticado)' })
  @IsUUID()
  sourceAccountId: string;

  @ApiProperty({ description: 'ID de la cuenta destino (debe ser del cliente autenticado)' })
  @IsUUID()
  destinationAccountId: string;

  @ApiProperty({ example: 150.0 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: AMOUNT_MSG })
  @IsPositive({ message: AMOUNT_MSG })
  @Max(9999999999999)
  amount: number;

  @ApiPropertyOptional({ example: 'Ahorro mensual' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

/** HU10: transferencia a otro cliente del banco, identificado por CCI. */
export class ThirdPartyTransferDto {
  @ApiProperty()
  @IsUUID()
  sourceAccountId: string;

  @ApiProperty({ example: '191-4567890123-45' })
  @IsString()
  @Matches(/^[0-9-]{10,25}$/, { message: 'CCI de destino inválido' })
  destinationCci: string;

  @ApiProperty({ example: 150.0 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: AMOUNT_MSG })
  @IsPositive({ message: AMOUNT_MSG })
  @Max(9999999999999)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

/** Contrato previo POST /transactions (el frontend actual); delega a los casos de uso anteriores. */
export class CreateTransferDto {
  @ApiProperty({ example: 'third-party', enum: ['internal', 'third-party', 'service'] })
  @IsNotEmpty()
  @IsIn(['internal', 'third-party', 'service'])
  transactionType: 'internal' | 'third-party' | 'service';

  @ApiProperty({ description: 'ID de la cuenta de origen' })
  @IsNotEmpty()
  @IsUUID()
  sourceAccountId: string;

  @ApiProperty({ description: 'ID de cuenta propia (internal) o CCI (third-party)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  destinationAccount: string;

  @ApiProperty({ example: 150.0 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: AMOUNT_MSG })
  @IsPositive({ message: AMOUNT_MSG })
  @Max(9999999999999)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
