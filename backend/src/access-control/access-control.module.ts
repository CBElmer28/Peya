import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { AdminAuditService } from './admin-audit.service';
import { PermissionsGuard } from './permissions.guard';
import { AdminActionInterceptor } from './admin-action.interceptor';

@Global()
@Module({
  providers: [PermissionsService, AdminAuditService, PermissionsGuard, AdminActionInterceptor],
  exports: [PermissionsService, AdminAuditService, PermissionsGuard, AdminActionInterceptor],
})
export class AccessControlModule {}
