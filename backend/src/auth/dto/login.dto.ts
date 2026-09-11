import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'demo@bankhub.com',
    description: 'Correo electrónico del usuario registrado',
  })
  @IsEmail({}, { message: 'El correo electrónico debe tener un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Contraseña de acceso',
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Indica si se mantiene la sesión activa en el equipo',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
