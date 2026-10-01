import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { auditStorage } from '../audit-context';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    // Los guards corren antes que los interceptores: req.user ya esta poblado en rutas protegidas.
    const usuario: string = request.user?.email || 'ANONYMOUS_USER';

    return new Observable((observer) => {
      auditStorage.run(usuario, () => {
        next.handle().subscribe({
          next: (v) => observer.next(v),
          error: (e) => observer.error(e),
          complete: () => observer.complete(),
        });
      });
    });
  }
}
