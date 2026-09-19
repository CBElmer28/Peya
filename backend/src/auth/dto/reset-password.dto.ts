import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Length } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Correo electrónico asociado',
    example: 'demo@bankhub.com',
  })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @IsString()
  email: string;

  @ApiProperty({
    description: 'Código de recuperación verificado',
    example: '839201',
  })
  @IsNotEmpty({ message: 'El token/código de recuperación es obligatorio.' })
  @IsString()
  @Length(6, 64)
  token: string;

  @ApiProperty({
    description: 'Nueva contraseña segura (mínimo 6 caracteres)',
    example: 'BankHubSecure2026!',
  })
  @IsNotEmpty({ message: 'La nueva contraseña no puede estar vacía.' })
  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres.' })
  newPassword: string;
}
