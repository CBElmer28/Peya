const DEV_JWT_SECRET = 'BANKHUB_DEV_ONLY_SECRET_DO_NOT_USE_IN_PROD';

/** En produccion JWT_SECRET es obligatorio: no existe valor por defecto utilizable. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio (mínimo 16 caracteres) en producción.');
  }
  return secret || DEV_JWT_SECRET;
}

/** Origenes CORS permitidos: CORS_ORIGINS="https://app.ejemplo.com,https://otro.com". */
export function getCorsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS es obligatorio en producción.');
  }
  return ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000', 'http://127.0.0.1:3002'];
}
