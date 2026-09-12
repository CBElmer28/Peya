import { KycService } from './kyc.service';
import { VerifyFaceDto } from './dto/verify-face.dto';
export declare class KycController {
    private readonly kycService;
    constructor(kycService: KycService);
    verifyFace(dto: VerifyFaceDto): Promise<import("./kyc.service").FaceVerificationResponse>;
}
