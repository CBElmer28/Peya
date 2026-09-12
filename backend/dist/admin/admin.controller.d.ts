import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getMetrics(): Promise<import("./admin.service").AdminMetric[]>;
    getSupervisedAccounts(): Promise<import("./admin.service").SupervisedAccount[]>;
}
