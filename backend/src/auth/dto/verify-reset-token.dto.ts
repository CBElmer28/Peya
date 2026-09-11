import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyResetTokenDto {
  @ApiProperty({
    description: 'Correo electrónico asociado a la solicitud',
    example: 'demo@bankhub.com',
  })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @IsString({ message: 'El correo debe ser una cadena válida.' })
  email: string;

  @ApiProperty({
    description: 'Código de verificación OTP o token de 6 dígitos',
    example: '839201',
  })
  @IsNotEmpty({ message: 'El código de verificación es obligatorio.' })
  @IsString({ message: 'El código debe ser una cadena de texto.' })
  @Length(6, 64, { message: 'El token/código debe tener entre 6 y 64 caracteres.' })
  token: string;
}
