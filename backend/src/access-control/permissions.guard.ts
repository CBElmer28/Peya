import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from './permissions.service';
import { AdminAuditService } from './admin-audit.service';
import { PermissionCode } from './permissions';

export const PERMISSIONS_KEY = 'required_permissions';
/** El acceso exige TODOS los permisos indicados. */
export const RequirePermissions = (...codes: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, codes);

/** Usar siempre despues de JwtAuthGuard. Los permisos salen de la BD, nunca del token ni del cliente. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
    private readonly audit: AdminAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const access = user ? await this.permissions.effectiveFor(user.id) : null;
    if (access && required.every((p) => access.permissions.has(p))) {
      req.access = access;
      return true;
    }

    if (user && access && access.kind !== 'none') {
      // Solo se auditan los intentos de personal administrativo; un cliente corriente no es "accion administrativa".
      await this.audit.recordSafe({
        actorId: user.id,
        action: 'ACCESO_DENEGADO',
        objectType: 'ENDPOINT',
        objectId: `${req.method} ${req.route?.path ?? 'desconocida'}`.slice(0, 64),
        result: 'DENEGADO',
        ip: req.ip,
      });
    }
    throw new ForbiddenException('No tienes permisos para realizar esta acción.');
  }
}
