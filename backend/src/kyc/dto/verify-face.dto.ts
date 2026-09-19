import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class VerifyFaceDto {
  @ApiProperty({
    example: 'data:image/jpeg;base64,...',
    description: 'Imagen selfie capturada por la cámara del dispositivo en base64',
  })
  @IsNotEmpty({ message: 'La selfie es obligatoria para la validación biométrica' })
  @IsString()
  selfieDataUrl: string;

  @ApiProperty({
    example: '48219032',
    required: false,
    description: 'DNI del usuario a validar contra el padrón',
  })
  @IsOptional()
  @IsString()
  dni?: string;
}
