import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsISO8601, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/**
 * HU15: unico campo de datos que el titular puede cambiar por si mismo: el correo. Nombre, DNI (RENIEC),
 * telefono, rol y estado no son editables aqui (ver PROTECTED_PROFILE_FIELDS); la documentacion solo
 * habla de "datos habilitados para actualizacion" y no habilita el telefono. Para habilitarlo despues basta
 * con agregar el campo aqui, quitarlo de PROTECTED_PROFILE_FIELDS y restaurar su manejo en el servicio.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'nuevo@correo.com', description: 'Cambiarlo exige currentPassword' })
  @ValidateIf((_, v) => v !== undefined)
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'El formato de correo electrónico no es válido' })
  @MaxLength(255, { message: 'El correo no puede superar 255 caracteres' })
  email?: string;

  @ApiPropertyOptional({ description: 'Contraseña actual; obligatoria solo para cambiar el correo' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  currentPassword?: string;

  @ApiPropertyOptional({
    example: '2026-10-26T15:04:05.123Z',
    description: 'updatedAt leido del perfil. Si cambio desde entonces, la operacion responde 409.',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'expectedUpdatedAt debe ser una fecha ISO 8601' })
  expectedUpdatedAt?: string;
}

/** Unico contenido aceptado en PATCH /users/me. */
export const PROFILE_EDITABLE_FIELDS = ['email', 'currentPassword', 'expectedUpdatedAt'];

/** Campos que existen en el perfil pero que el titular nunca puede modificar por esta via. */
export const PROTECTED_PROFILE_FIELDS = [
  'id',
  'name',
  'nombres',
  'apellidos',
  'dni',
  'phone',
  'telefono',
  'role',
  'rol',
  'status',
  'estado',
  'registeredAt',
  'updatedAt',
  'password',
  'passwordHash',
  'password_hash',
  'selfieUrl',
];
