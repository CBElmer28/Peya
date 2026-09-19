import { Injectable, BadRequestException } from '@nestjs/common';
import { VerifyFaceDto } from './dto/verify-face.dto';

export interface FaceVerificationResponse {
  match: boolean;
  confidence: number;
  message: string;
  verifiedAt: string;
}

@Injectable()
export class KycService {
  async verifyFace(dto: VerifyFaceDto): Promise<FaceVerificationResponse> {
    if (!dto.selfieDataUrl || !dto.selfieDataUrl.startsWith('data:image')) {
      throw new BadRequestException('Formato de imagen inválido. Debe ser una imagen en Base64.');
    }

    // Simulación de comparación de vector facial contra fotografía RENIEC
    return {
      match: true,
      confidence: 0.96,
      message: 'Validación biométrica exitosa. Identidad confirmada.',
      verifiedAt: new Date().toISOString(),
    };
  }
}
