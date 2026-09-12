import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetTokenDto } from './dto/verify-reset-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: "client" | "admin";
        };
    }>;
    logout(authHeader?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getProfile(req: any): Promise<any>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        success: boolean;
        message: string;
        emailPreview?: string;
        devOtp?: string;
    }>;
    verifyResetToken(dto: VerifyResetTokenDto): Promise<{
        valid: boolean;
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
}
