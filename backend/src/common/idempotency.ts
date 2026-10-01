import { createHash } from 'crypto';
import { Tx } from '../prisma/prisma.service';
import { businessError } from './business-error';

const KEY_RE = /^[A-Za-z0-9_.:-]{8,100}$/;

/** La clave es obligatoria en operaciones que crean recursos o mueven dinero. */
export function requireIdempotencyKey(key?: string): string {
  if (!key || !KEY_RE.test(key)) {
    throw businessError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Se requiere el encabezado Idempotency-Key (8 a 100 caracteres: letras, números, "-", "_", ".", ":").',
    );
  }
  return key;
}

export function hashRequest(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(Object.keys(payload).sort().map((k) => [k, payload[k] ?? null]));
  return createHash('sha256').update(canonical).digest('hex');
}

export type IdempotencyStart = { replay: any } | { id: string; replay?: undefined };

/**
 * Debe llamarse DENTRO de la transaccion de negocio.
 *
 * INSERT .. ON CONFLICT DO NOTHING sobre UNIQUE(id_cliente, operacion, clave):
 *  - clave nueva: se inserta y la operacion continua;
 *  - clave en vuelo por otra transaccion: Postgres bloquea hasta que esa transaccion termine.
 *    Si hizo commit, el INSERT no inserta nada y se devuelve la respuesta guardada (replay);
 *    si hizo rollback, este INSERT procede y la operacion se ejecuta (reintento valido);
 *  - misma clave con payload distinto: 422 (reuso indebido de la clave).
 * La clave se guarda atomicamente con el efecto financiero: no puede haber efecto sin clave ni viceversa.
 */
export async function beginIdempotent(
  tx: Tx,
  clienteId: string,
  operacion: string,
  clave: string,
  hash: string,
): Promise<IdempotencyStart> {
  const inserted = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO idempotencia (id_cliente, operacion, clave, hash_solicitud)
    VALUES (${clienteId}::uuid, ${operacion}, ${clave}, ${hash})
    ON CONFLICT (id_cliente, operacion, clave) DO NOTHING
    RETURNING id::text AS id`;
  if (inserted.length) return { id: inserted[0].id };

  const existing = await tx.$queryRaw<{ hash_solicitud: string; respuesta: any }[]>`
    SELECT hash_solicitud, respuesta FROM idempotencia
    WHERE id_cliente = ${clienteId}::uuid AND operacion = ${operacion} AND clave = ${clave}`;
  const row = existing[0];
  if (!row || row.hash_solicitud.trim() !== hash) {
    throw businessError(
      422,
      'IDEMPOTENCY_KEY_REUSED',
      'La clave de idempotencia ya fue utilizada con una solicitud diferente.',
    );
  }
  if (row.respuesta == null) {
    throw businessError(409, 'OPERATION_IN_PROGRESS', 'La operación original sigue en proceso. Reintenta en unos segundos.');
  }
  return { replay: row.respuesta };
}

export async function completeIdempotent(tx: Tx, id: string, recursoId: string, respuesta: unknown): Promise<void> {
  await tx.$executeRaw`
    UPDATE idempotencia SET recurso_id = ${recursoId}::uuid, respuesta = ${JSON.stringify(respuesta)}::jsonb
    WHERE id = ${id}::uuid`;
}
