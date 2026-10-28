import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class QueryOperationsDto {
  @ApiPropertyOptional({
    description: 'Búsqueda por texto: DNI, nombre del cliente, CCI o descripción',
    example: 'Transferencia',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de operación',
    enum: ['CREDITO', 'DEBITO', 'TODOS'],
    example: 'CREDITO',
  })
  @IsOptional()
  @IsIn(['CREDITO', 'DEBITO', 'TODOS'])
  type?: 'CREDITO' | 'DEBITO' | 'TODOS';

  @ApiPropertyOptional({
    description: 'Fecha inicial (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha inicial debe tener formato YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Fecha final (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha final debe tener formato YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ description: 'Monto mínimo', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Monto máximo', example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Filtrar por ID de cuenta específica' })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de cliente específico' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Número de página', default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Cantidad de registros por página (máx. 100)', default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
