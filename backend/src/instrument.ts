/**
 * Observabilidad (Sentry). Debe importarse ANTES que cualquier otro modulo (primera linea de main.ts).
 * Sin SENTRY_DSN queda desactivado (desarrollo/pruebas).
 */
import * as Sentry from '@sentry/nestjs';

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'idempotency-key', 'x-api-key'];

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test',
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  release: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SENTRY_RELEASE,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  // App financiera: PII desactivada por defecto; ademas beforeSend elimina cuerpos, cookies y cabeceras sensibles.
  beforeSend(event) {
    if (event.request) {
      // Nunca enviar cuerpos (saldos, CCI, contrasenas, selfies) ni query strings.
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.query_string;
      if (event.request.headers) {
        for (const h of Object.keys(event.request.headers)) {
          if (SENSITIVE_HEADERS.includes(h.toLowerCase())) delete event.request.headers[h];
        }
      }
    }
    if (event.user) event.user = { id: event.user.id };
    return event;
  },
});
