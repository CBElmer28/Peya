import { UsersService } from '../users/users.service';
export interface ReniecDniResponse {
    dni: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    fechaNacimiento: string;
}
export declare class ReniecService {
    private readonly usersService;
    private readonly logger;
    constructor(usersService: UsersService);
    lookupDni(dni: string): Promise<ReniecDniResponse>;
}
