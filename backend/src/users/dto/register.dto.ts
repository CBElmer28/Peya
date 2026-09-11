import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: '48219032',
    description: 'DNI del usuario (8 dígitos numéricos peruanos)',
  })
  @IsNotEmpty({ message: 'El DNI es obligatorio' })
  @Length(8, 8, { message: 'El DNI debe tener exactamente 8 dígitos' })
  @Matches(/^\d{8}$/, { message: 'El DNI debe contener solo números' })
  dni: string;

  @ApiProperty({
    example: 'Priscilla Fernanda Quispe Torres',
    required: false,
    description: 'Nombre completo obtenido de RENIEC',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'usuario@bankhub.com',
    description: 'Correo electrónico único del usuario',
  })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  @IsEmail({}, { message: 'El formato de correo electrónico no es válido' })
  email: string;

  @ApiProperty({
    example: '987654321',
    description: 'Número de celular en Perú (9 dígitos que inician en 9)',
  })
  @IsNotEmpty({ message: 'El número de celular es obligatorio' })
  @Matches(/^9\d{8}$/, {
    message: 'El teléfono debe ser un celular peruano válido de 9 dígitos comenzando con 9',
  })
  phone: string;

  @ApiProperty({
    example: 'ClaveSegura123!',
    description: 'Contraseña alfanumérica de al menos 8 caracteres',
  })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(8, 64, { message: 'La contraseña debe tener entre 8 y 64 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'La contraseña debe incluir letras y números',
  })
  password: string;

  @ApiProperty({
    example: 'data:image/jpeg;base64,...',
    required: false,
    description: 'Foto selfie en formato base64 para verificación KYC',
  })
  @IsOptional()
  @IsString()
  selfieUrl?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Ana Martínez' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'ana.martinez@bankhub.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin', enum: ['client', 'admin'] })
  @IsNotEmpty()
  role: 'client' | 'admin';
}

export class UpdateUserDto {
  @ApiProperty({ example: 'Ana Martínez', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'ana.martinez@bankhub.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'admin', enum: ['client', 'admin'], required: false })
  @IsOptional()
  role?: 'client' | 'admin';

  @ApiProperty({ example: 'active', enum: ['active', 'inactive'], required: false })
  @IsOptional()
  status?: 'active' | 'inactive';
}
