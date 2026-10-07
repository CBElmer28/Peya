import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Paginacion + orden por fecha (HU07). */
export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc', description: 'Orden por fecha' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}

/** Filtros HU08. El cliente nunca se recibe por parametro: sale del JWT. */
export class MovementsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Cuenta (debe pertenecer al cliente autenticado)' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Fecha inicial (YYYY-MM-DD), inclusive' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'from debe tener formato YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Fecha final (YYYY-MM-DD), inclusive' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'to debe tener formato YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ enum: ['CREDITO', 'DEBITO'], description: 'Tipo de operación' })
  @IsOptional()
  @IsIn(['CREDITO', 'DEBITO'])
  type?: 'CREDITO' | 'DEBITO';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999999)
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999999)
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Búsqueda por descripción (mín. 2 caracteres)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q?: string;
}
