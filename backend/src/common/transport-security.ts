import type { NextFunction, Request, Response } from 'express';

/** HTTPS es obligatorio en produccion salvo que se desactive a proposito (FORCE_HTTPS=false). */
export function isHttpsEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' && env.FORCE_HTTPS !== 'false';
}

/**
 * Rechaza peticiones que no llegaron por HTTPS (req.secure respeta X-Forwarded-Proto gracias a
 * `trust proxy`). Responde 426 en vez de redirigir: redirigir a partir de la cabecera Host seria un
 * open-redirect, y mandar datos personales por HTTP ya los habria expuesto antes del redirect.
 * /api/health queda exento para los chequeos internos de la plataforma.
 */
export function httpsOnly(enabled: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled || req.secure || req.path === '/api/health') return next();
    res.status(426).json({
      statusCode: 426,
      error: 'HTTPS_REQUIRED',
      message: 'Este servicio solo acepta conexiones seguras (HTTPS).',
    });
  };
}

/** Politica HSTS: 1 año, subdominios incluidos. */
export const HSTS_OPTIONS = { maxAge: 31536000, includeSubDomains: true } as const;

/**
 * Advierte si la conexion a la BD podria viajar sin TLS fuera de entornos locales/internos.
 * Devuelve el mensaje (o null) para que el arranque lo registre sin exponer la cadena de conexion.
 */
export function databaseTlsWarning(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NODE_ENV !== 'production' || !env.DATABASE_URL) return null;
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    return 'DATABASE_URL no es una URL valida.';
  }
  const internal = ['localhost', '127.0.0.1'].includes(url.hostname) || url.hostname.endsWith('.internal');
  const sslmode = url.searchParams.get('sslmode');
  const secure = sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full';
  return internal || secure ? null : 'DATABASE_URL no exige TLS (agrega ?sslmode=require).';
}
