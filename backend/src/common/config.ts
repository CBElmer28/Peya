/**
 * Reglas de negocio configurables. Los valores por defecto son PROVISIONALES: el Sprint 2 no
 * define cifras (saldo minimo, limites). Ver "decisiones pendientes" en el reporte.
 */
function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const limits = {
  maxAccountsPerClient: () => num('MAX_ACCOUNTS_PER_CLIENT', 10),
  transferPerOperation: () => num('TRANSFER_LIMIT_PER_OPERATION', 20000),
  transferDaily: () => num('TRANSFER_LIMIT_DAILY', 50000),
};
