/** "191-3001234567-89" -> "****6789" (ultimos 4 digitos). */
export function maskCci(cci: string): string {
  const digits = (cci || '').replace(/\D/g, '');
  return `****${digits.slice(-4)}`;
}
