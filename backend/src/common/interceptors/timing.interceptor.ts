import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SLOW_MS = 1000;

/**
 * Metrica de tiempo de respuesta (HU06/HU09/HU11/HU12). Solo registra metodo, ruta (sin query
 * ni ids) y duracion: nunca saldos, cuentas ni cuerpos de peticion.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Timing');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const start = process.hrtime.bigint();
    const route: string = req.route?.path ?? 'unknown';

    const finish = () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (!res.headersSent) res.setHeader('Server-Timing', `app;dur=${ms.toFixed(1)}`);
      if (ms > SLOW_MS) this.logger.warn(`${req.method} ${route} lento: ${ms.toFixed(0)} ms`);
      else this.logger.debug(`${req.method} ${route} ${ms.toFixed(0)} ms`);
    };

    return next.handle().pipe(tap({ next: finish, error: finish }));
  }
}
