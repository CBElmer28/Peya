import { ReniecService } from './reniec.service';
export declare class ReniecController {
    private readonly reniecService;
    constructor(reniecService: ReniecService);
    lookupDni(numero: string): Promise<import("./reniec.service").ReniecDniResponse>;
}
