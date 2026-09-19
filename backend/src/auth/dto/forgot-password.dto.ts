import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Correo electrónico o número de DNI registrado',
    example: 'demo@bankhub.com',
  })
  @IsNotEmpty({ message: 'El correo electrónico o DNI es obligatorio.' })
  @IsString({ message: 'El identificador debe ser una cadena de texto válida.' })
  identifier: string;
}
