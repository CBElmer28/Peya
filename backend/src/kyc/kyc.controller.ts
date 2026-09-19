import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { VerifyFaceDto } from './dto/verify-face.dto';

@ApiTags('Biometría & KYC (HU1)')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('verify-face')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Verificación biométrica facial (KYC)' })
  @ApiResponse({ status: 200, description: 'Rostro verificado y comparado satisfactoriamente.' })
  @ApiResponse({ status: 400, description: 'Imagen selfie inválida.' })
  async verifyFace(@Body() dto: VerifyFaceDto) {
    return this.kycService.verifyFace(dto);
  }
}
