import { Prisma } from '@prisma/client';

export type Dec = Prisma.Decimal;

export function formatMoney(value: Dec | number | string, currency: string): string {
  const n = Number(value);
  const f = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return currency === 'PEN' ? `S/. ${f}` : `USD ${f}`;
}

/** Valida que el monto tenga como maximo 2 decimales (el DTO recibe number). */
export function hasMaxTwoDecimals(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}
