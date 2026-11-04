import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { User } from '../users.service';

/**
 * HU14: unica forma en que el perfil sale de la API. Es una lista blanca explicita:
 * cualquier campo nuevo de User (hash, selfie, tabla de origen, contadores de seguridad...)
 * queda fuera hasta que se agregue aqui a proposito.
 */
export class ProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: ['client', 'admin'] }) role: 'client' | 'admin';
  @ApiPropertyOptional({ description: 'Solo clientes; los administradores no tienen DNI.' }) dni?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty({ enum: ['active', 'inactive'] }) status: 'active' | 'inactive';
  @ApiProperty({ description: 'Fecha de registro (YYYY-MM-DD)' }) registeredAt: string;
  @ApiProperty({ description: 'Ultima modificacion (ISO 8601); enviar como expectedUpdatedAt al actualizar' }) updatedAt: string;

  static from(user: User): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.role = user.role;
    if (user.dni) dto.dni = user.dni;
    if (user.phone) dto.phone = user.phone;
    dto.status = user.status;
    dto.registeredAt = user.registeredAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
