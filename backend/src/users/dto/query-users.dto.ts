import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryUsersDto {
  @ApiPropertyOptional({
    description: 'Término de búsqueda: DNI, nombres, apellidos o correo electrónico',
    example: 'Carlos',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del cliente',
    enum: ['active', 'inactive', 'all'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status?: 'active' | 'inactive' | 'all';

  @ApiPropertyOptional({
    description: 'Filtrar por rol',
    enum: ['client', 'admin', 'all'],
    example: 'client',
  })
  @IsOptional()
  @IsIn(['client', 'admin', 'all'])
  role?: 'client' | 'admin' | 'all';

  @ApiPropertyOptional({
    description: 'Número de página para paginación (comienza en 1)',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de clientes por página (máx. 100)',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
