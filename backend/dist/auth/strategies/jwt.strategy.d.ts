import { Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly usersService;
    private readonly authService;
    constructor(usersService: UsersService, authService: AuthService);
    validate(req: any, payload: {
        sub: string;
        email: string;
        name: string;
        role: string;
    }): Promise<{
        id: string;
        email: string;
        name: string;
        role: "admin" | "client";
    }>;
}
export {};
