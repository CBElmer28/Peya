import { VerifyFaceDto } from './dto/verify-face.dto';
export interface FaceVerificationResponse {
    match: boolean;
    confidence: number;
    message: string;
    verifiedAt: string;
}
export declare class KycService {
    verifyFace(dto: VerifyFaceDto): Promise<FaceVerificationResponse>;
}
