import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AdminAuditService } from './admin-audit.service';

export const ADMIN_ACTION_KEY = 'admin_action';
/** Marca un handler como accion administrativa auditable (actor, accion, objeto, resultado, fecha). */
export const AuditAdminAction = (action: string, objectType: string) =>
  SetMetadata(ADMIN_ACTION_KEY, { action, objectType });

/**
 * Auditoria generica de las acciones administrativas existentes. No registra cuerpos ni parametros
 * de consulta: solo el id del objeto afectado (param :id o id de la respuesta).
 */
@Injectable()
export class AdminActionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AdminAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<{ action: string; objectType: string }>(ADMIN_ACTION_KEY, context.getHandler());
    const req = context.switchToHttp().getRequest();
    if (!meta || !req.user?.id) return next.handle();

    const base = { actorId: req.user.id as string, action: meta.action, objectType: meta.objectType, ip: req.ip };
    return next.handle().pipe(
      tap({
        next: (body) =>
          void this.audit.recordSafe({
            ...base,
            objectId: (req.params?.id ?? (body as { id?: string } | undefined)?.id ?? null) as string | null,
            result: 'EXITO',
          }),
        error: (err) =>
          void this.audit.recordSafe({
            ...base,
            objectId: (req.params?.id ?? null) as string | null,
            result: err instanceof HttpException && err.getStatus() === 403 ? 'DENEGADO' : 'ERROR',
          }),
      }),
    );
  }
}
