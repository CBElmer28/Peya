import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const ROLE_NAME_RE = /^[A-Z_]{2,40}$/;

export class RolesDto {
  @ApiProperty({ example: ['SOPORTE'], description: 'Nombres de roles existentes (tabla rol)' })
  @IsArray({ message: 'roles debe ser una lista' })
  @ArrayNotEmpty({ message: 'Debes asignar al menos un rol' })
  @ArrayMaxSize(5, { message: 'No se pueden asignar mas de 5 roles' })
  @ArrayUnique({ message: 'Los roles no pueden repetirse' })
  @IsString({ each: true })
  @Matches(ROLE_NAME_RE, { each: true, message: 'Nombre de rol invalido' })
  roles: string[];
}

export class CreateSubadminDto extends RolesDto {
  @ApiProperty({ example: 'Marta Soporte' })
  @Transform(trim)
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres' })
  @Matches(/^[\p{L}][\p{L}\s.'-]*$/u, { message: 'El nombre solo admite letras, espacios, punto, apostrofe y guion' })
  name: string;

  @ApiProperty({ example: 'marta.soporte@bankhub.com' })
  @Transform(trim)
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El formato de correo electrónico no es válido' })
  @MaxLength(255, { message: 'El correo no puede superar 255 caracteres' })
  email: string;

  @ApiProperty({ example: 'ClaveSegura123' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(8, 64, { message: 'La contraseña debe tener entre 8 y 64 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, { message: 'La contraseña debe incluir letras y números' })
  password: string;
}
