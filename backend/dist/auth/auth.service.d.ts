import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    private failedAttempts;
    private readonly MAX_ATTEMPTS;
    private readonly LOCKOUT_DURATION_MS;
    private revokedTokens;
    private resetTokens;
    constructor(usersService: UsersService, jwtService: JwtService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        tokenType: string;
        expiresIn: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: 'client' | 'admin';
        };
    }>;
    logout(token?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    isTokenRevoked(token: string): boolean;
    forgotPassword(identifier: string): Promise<{
        success: boolean;
        message: string;
        emailPreview?: string;
        devOtp?: string;
    }>;
    verifyResetToken(email: string, token: string): Promise<{
        valid: boolean;
        message: string;
    }>;
    resetPassword(email: string, token: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    validateUserFromJwt(payload: {
        sub: string;
        email: string;
        name: string;
        role: string;
    }): Promise<import("../users/users.service").User>;
}
