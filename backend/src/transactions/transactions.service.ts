import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { businessError } from '../common/business-error';
import { limits } from '../common/config';
import { maskCci } from '../common/masking';
import { formatMoney } from '../common/money';
import {
  beginIdempotent,
  completeIdempotent,
  hashRequest,
  requireIdempotencyKey,
} from '../common/idempotency';
import { isUuid } from '../accounts/accounts.service';
import {
  CreateTransferDto,
  InternalTransferDto,
  ThirdPartyTransferDto,
} from './dto/create-transfer.dto';

export interface TransferResult {
  status: 'success';
  transferId: string;
  reference: string;
  newBalance: number;
  transferredAt: string;
  estado: 'COMPLETADO';
}

interface LockedAccount {
  id: string;
  id_cliente: string;
  saldo: Prisma.Decimal;
  moneda: string;
  estado_cuenta: string;
  cci: string;
}

export const referenceOf = (id: string) => `TRX-${id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

/** "Carlos Ruiz Pérez" -> "Carlos R." (identifica sin exponer el nombre completo). */
function maskHolder(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[0][0].toUpperCase()}.` : first;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Compatibilidad con POST /transactions del frontend actual. */
  async processTransfer(user: AuthUser, dto: CreateTransferDto, idempotencyKey?: string): Promise<TransferResult> {
    if (dto.transactionType === 'internal') {
      return this.internalTransfer(
        user,
        {
          sourceAccountId: dto.sourceAccountId,
          destinationAccountId: dto.destinationAccount,
          amount: dto.amount,
          description: dto.description,
        },
        idempotencyKey,
      );
    }
    if (dto.transactionType === 'third-party') {
      return this.thirdPartyTransfer(
        user,
        {
          sourceAccountId: dto.sourceAccountId,
          destinationCci: dto.destinationAccount,
          amount: dto.amount,
          description: dto.description,
        },
        idempotencyKey,
      );
    }
    throw businessError(422, 'OPERATION_NOT_SUPPORTED', 'Este tipo de operación aún no está disponible.');
  }

  /** HU09 */
  async internalTransfer(user: AuthUser, dto: InternalTransferDto, idempotencyKey?: string): Promise<TransferResult> {
    const key = requireIdempotencyKey(idempotencyKey);
    if (!isUuid(dto.destinationAccountId)) {
      throw businessError(400, 'INVALID_DESTINATION', 'Cuenta destino inválida.');
    }
    if (dto.sourceAccountId.toLowerCase() === dto.destinationAccountId.toLowerCase()) {
      throw businessError(422, 'SAME_ACCOUNT', 'La cuenta origen y destino deben ser diferentes.');
    }
    const amount = new Prisma.Decimal(dto.amount.toFixed(2));
    const hash = hashRequest({
      op: 'INTERNAL',
      src: dto.sourceAccountId.toLowerCase(),
      dst: dto.destinationAccountId.toLowerCase(),
      amount: amount.toFixed(2),
      description: dto.description ?? null,
    });

    return this.prisma.transaction(async (tx) => {
      const idem = await beginIdempotent(tx, user.id, 'TRANSFER_INTERNAL', key, hash);
      if (!('id' in idem)) return idem.replay as TransferResult;

      const accounts = await this.lockAccounts(tx, [dto.sourceAccountId, dto.destinationAccountId]);
      const src = accounts.get(dto.sourceAccountId.toLowerCase());
      const dst = accounts.get(dto.destinationAccountId.toLowerCase());
      // Ownership: ambas cuentas deben ser del cliente autenticado; si no, 404 sin detalles.
      if (!src || src.id_cliente !== user.id) throw new NotFoundException('Cuenta de origen no encontrada');
      if (!dst || dst.id_cliente !== user.id) throw new NotFoundException('Cuenta de destino no encontrada');

      await this.assertTransferable(tx, user.id, src, dst, amount);

      const [t] = await tx.$queryRaw<{ id: string; fecha: Date }[]>`
        INSERT INTO transferencia_internas (id_cuenta_origen, id_cuenta_destino, monto, moneda, descripcion, estado)
        VALUES (${src.id}::uuid, ${dst.id}::uuid, ${amount}, ${src.moneda}, ${dto.description ?? null}, 'PENDIENTE')
        RETURNING id::text AS id, fecha_creacion AS fecha`;

      const newBalance = await this.moveFunds(tx, src, dst, amount, {
        kind: 'interna',
        transferId: t.id,
        debitDesc: dto.description?.trim() || `Transferencia a cuenta propia ${maskCci(dst.cci)}`,
        creditDesc: dto.description?.trim() || `Transferencia desde cuenta propia ${maskCci(src.cci)}`,
      });

      await tx.$executeRaw`UPDATE transferencia_internas SET estado = 'COMPLETADO' WHERE id = ${t.id}::uuid`;

      const result: TransferResult = {
        status: 'success',
        transferId: t.id,
        reference: referenceOf(t.id),
        newBalance: Number(newBalance),
        transferredAt: t.fecha.toISOString(),
        estado: 'COMPLETADO',
      };
      await completeIdempotent(tx, idem.id, t.id, result);
      return result;
    });
  }

  /** HU10 */
  async thirdPartyTransfer(user: AuthUser, dto: ThirdPartyTransferDto, idempotencyKey?: string): Promise<TransferResult> {
    const key = requireIdempotencyKey(idempotencyKey);
    if (!isUuid(dto.sourceAccountId)) throw new NotFoundException('Cuenta de origen no encontrada');
    const amount = new Prisma.Decimal(dto.amount.toFixed(2));
    const cci = dto.destinationCci.trim();
    const hash = hashRequest({
      op: 'THIRD_PARTY',
      src: dto.sourceAccountId.toLowerCase(),
      cci,
      amount: amount.toFixed(2),
      description: dto.description ?? null,
    });

    return this.prisma.transaction(async (tx) => {
      const idem = await beginIdempotent(tx, user.id, 'TRANSFER_EXTERNAL', key, hash);
      if (!('id' in idem)) return idem.replay as TransferResult;

      // El destino se resuelve por CCI; su estado/saldo se relee bajo lock a continuacion.
      const found = await tx.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM cuenta WHERE cci = ${cci}`;
      if (!found.length) {
        throw businessError(404, 'DESTINATION_NOT_FOUND', 'La cuenta de destino no existe.');
      }

      const accounts = await this.lockAccounts(tx, [dto.sourceAccountId, found[0].id]);
      const src = accounts.get(dto.sourceAccountId.toLowerCase());
      const dst = accounts.get(found[0].id.toLowerCase());
      if (!src || src.id_cliente !== user.id) throw new NotFoundException('Cuenta de origen no encontrada');
      if (!dst) throw businessError(404, 'DESTINATION_NOT_FOUND', 'La cuenta de destino no existe.');
      if (dst.id_cliente === user.id) {
        throw businessError(
          422,
          'USE_OWN_TRANSFER',
          'La cuenta destino es tuya. Usa la transferencia entre cuentas propias.',
        );
      }

      await this.assertTransferable(tx, user.id, src, dst, amount);

      const [t] = await tx.$queryRaw<{ id: string; fecha: Date }[]>`
        INSERT INTO transferencia_externa
          (id_cuenta_origen, id_cuenta_destino, cci_destino, monto, moneda, descripcion, estado)
        VALUES (${src.id}::uuid, ${dst.id}::uuid, ${dst.cci}, ${amount}, ${src.moneda}, ${dto.description ?? null}, 'PENDIENTE')
        RETURNING id::text AS id, fecha_creacion AS fecha`;

      const newBalance = await this.moveFunds(tx, src, dst, amount, {
        kind: 'externa',
        transferId: t.id,
        debitDesc: dto.description?.trim() || `Transferencia enviada a ${maskCci(dst.cci)}`,
        creditDesc: dto.description?.trim() || `Transferencia recibida de ${maskCci(src.cci)}`,
      });

      await tx.$executeRaw`UPDATE transferencia_externa SET estado = 'COMPLETADO' WHERE id = ${t.id}::uuid`;

      const result: TransferResult = {
        status: 'success',
        transferId: t.id,
        reference: referenceOf(t.id),
        newBalance: Number(newBalance),
        transferredAt: t.fecha.toISOString(),
        estado: 'COMPLETADO',
      };
      await completeIdempotent(tx, idem.id, t.id, result);
      return result;
    });
  }

  /** Valida un CCI destino antes de transferir (HU10: "destinatario validado"). Datos minimos y enmascarados. */
  async validateDestination(user: AuthUser, cci: string) {
    const rows = await this.prisma.$queryRaw<
      { cci: string; moneda: string; estado_cuenta: string; id_cliente: string; nombres: string; apellidos: string }[]
    >`
      SELECT c.cci, c.moneda, c.estado_cuenta, c.id_cliente::text AS id_cliente, p.nombres, p.apellidos
      FROM cuenta c JOIN cliente p ON p.id = c.id_cliente
      WHERE c.cci = ${cci.trim()}`;
    const r = rows[0];
    if (!r || r.estado_cuenta !== 'ACTIVA') {
      throw businessError(404, 'DESTINATION_NOT_FOUND', 'La cuenta de destino no existe.');
    }
    return {
      maskedNumber: maskCci(r.cci),
      holder: maskHolder(`${r.nombres} ${r.apellidos}`),
      currency: r.moneda,
      isOwnAccount: r.id_cliente === user.id,
    };
  }

  /**
   * Bloquea las cuentas con SELECT .. FOR UPDATE en orden determinista (por id) para evitar
   * deadlocks entre A->B y B->A concurrentes. READ COMMITTED + lock: el saldo leido bajo lock
   * ya no puede ser modificado por otra transaccion hasta el commit/rollback.
   */
  private async lockAccounts(tx: Tx, ids: string[]): Promise<Map<string, LockedAccount>> {
    const clean = ids.filter(isUuid).map((i) => i.toLowerCase());
    if (!clean.length) return new Map();
    const rows = await tx.$queryRaw<LockedAccount[]>`
      SELECT id::text AS id, id_cliente::text AS id_cliente, saldo, moneda, estado_cuenta, cci
      FROM cuenta
      WHERE id = ANY(${clean}::uuid[])
      ORDER BY id
      FOR UPDATE`;
    return new Map(rows.map((r) => [r.id.toLowerCase(), r]));
  }

  private async assertTransferable(tx: Tx, clienteId: string, src: LockedAccount, dst: LockedAccount, amount: Prisma.Decimal) {
    if (src.estado_cuenta !== 'ACTIVA') {
      throw businessError(422, 'SOURCE_ACCOUNT_NOT_ACTIVE', 'La cuenta de origen no está activa.');
    }
    if (dst.estado_cuenta !== 'ACTIVA') {
      throw businessError(422, 'DESTINATION_NOT_ACTIVE', 'La cuenta de destino no está activa.');
    }
    // Sin tipo de cambio definido en el Sprint: solo misma moneda.
    if (src.moneda !== dst.moneda) {
      throw businessError(422, 'CURRENCY_MISMATCH', 'Las cuentas deben estar en la misma moneda.');
    }
    if (amount.gt(limits.transferPerOperation())) {
      throw businessError(422, 'TRANSFER_LIMIT_EXCEEDED', 'El monto excede el límite por operación.');
    }
    const [{ total }] = await tx.$queryRaw<{ total: Prisma.Decimal }[]>`
      SELECT COALESCE(SUM(x.monto), 0) AS total FROM (
        SELECT t.monto FROM transferencia_internas t JOIN cuenta o ON o.id = t.id_cuenta_origen
         WHERE o.id_cliente = ${clienteId}::uuid AND t.estado = 'COMPLETADO' AND t.fecha_creacion >= date_trunc('day', now())
        UNION ALL
        SELECT t.monto FROM transferencia_externa t JOIN cuenta o ON o.id = t.id_cuenta_origen
         WHERE o.id_cliente = ${clienteId}::uuid AND t.estado = 'COMPLETADO' AND t.fecha_creacion >= date_trunc('day', now())
      ) x`;
    if (new Prisma.Decimal(total).plus(amount).gt(limits.transferDaily())) {
      throw businessError(422, 'DAILY_LIMIT_EXCEEDED', 'La operación excede tu límite diario de transferencias.');
    }
    if (src.saldo.lt(amount)) {
      throw businessError(
        422,
        'INSUFFICIENT_FUNDS',
        `Fondos insuficientes. Saldo disponible: ${formatMoney(src.saldo, src.moneda)}, Monto solicitado: ${formatMoney(amount, src.moneda)}`,
      );
    }
  }

  /** Debito + credito + 2 movimientos. Devuelve el nuevo saldo del origen. */
  private async moveFunds(
    tx: Tx,
    src: LockedAccount,
    dst: LockedAccount,
    amount: Prisma.Decimal,
    ctx: { kind: 'interna' | 'externa'; transferId: string; debitDesc: string; creditDesc: string },
  ): Promise<Prisma.Decimal> {
    // La condicion saldo >= monto y el CHECK (saldo >= 0) son defensas adicionales al lock.
    const debited = await tx.$queryRaw<{ saldo: Prisma.Decimal }[]>`
      UPDATE cuenta SET saldo = saldo - ${amount}, fecha_actualizacion = now()
      WHERE id = ${src.id}::uuid AND saldo >= ${amount}
      RETURNING saldo`;
    if (!debited.length) {
      throw businessError(422, 'INSUFFICIENT_FUNDS', 'Fondos insuficientes.');
    }
    const credited = await tx.$queryRaw<{ saldo: Prisma.Decimal }[]>`
      UPDATE cuenta SET saldo = saldo + ${amount}, fecha_actualizacion = now()
      WHERE id = ${dst.id}::uuid
      RETURNING saldo`;

    const ti = ctx.kind === 'interna' ? ctx.transferId : null;
    const te = ctx.kind === 'externa' ? ctx.transferId : null;
    await tx.$executeRaw`
      INSERT INTO movimiento (id_cuenta, tipo, categoria, monto, saldo_posterior, descripcion, id_transferencia_interna, id_transferencia_externa)
      VALUES (${src.id}::uuid, 'DEBITO', 'Transferencia', ${amount}, ${debited[0].saldo}, ${ctx.debitDesc}, ${ti}::uuid, ${te}::uuid),
             (${dst.id}::uuid, 'CREDITO', 'Transferencia', ${amount}, ${credited[0].saldo}, ${ctx.creditDesc}, ${ti}::uuid, ${te}::uuid)`;
    return debited[0].saldo;
  }

  /**
   * HU11: destinatarios recientes del cliente autenticado, sin duplicados (por cuenta destino),
   * ordenados por ultimo uso. Usa ix_cuenta_cliente + ix_te_origen_fecha.
   */
  async recentRecipients(clienteId: string, limit: number, page: number) {
    const rows = await this.prisma.$queryRaw<
      { cci: string; moneda: string; nombres: string; apellidos: string; ultimo_uso: Date; veces: number }[]
    >`
      SELECT d.cci, d.moneda, p.nombres, p.apellidos, MAX(te.fecha_creacion) AS ultimo_uso, COUNT(*)::int AS veces
      FROM cuenta o
      JOIN transferencia_externa te ON te.id_cuenta_origen = o.id AND te.estado = 'COMPLETADO'
      JOIN cuenta d ON d.id = te.id_cuenta_destino
      JOIN cliente p ON p.id = d.id_cliente
      WHERE o.id_cliente = ${clienteId}::uuid
      GROUP BY d.id, d.cci, d.moneda, p.nombres, p.apellidos
      ORDER BY ultimo_uso DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    return {
      items: rows.map((r) => ({
        holder: maskHolder(`${r.nombres} ${r.apellidos}`),
        maskedNumber: maskCci(r.cci),
        // El CCI completo se necesita para reutilizar al destinatario; es dato del propio historial del cliente.
        destinationCci: r.cci,
        currency: r.moneda,
        lastUsedAt: r.ultimo_uso.toISOString(),
        timesUsed: r.veces,
      })),
      page,
      pageSize: limit,
    };
  }

  /**
   * HU12: constancia construida solo desde registros persistidos. Solo el cliente ordenante
   * (dueno de la cuenta origen) puede consultarla; ajena o inexistente => 404.
   */
  async receipt(clienteId: string, transferId: string) {
    if (!isUuid(transferId)) throw new NotFoundException('Constancia no encontrada');
    const rows = await this.prisma.$queryRaw<
      {
        tipo: string;
        id: string;
        monto: Prisma.Decimal;
        moneda: string;
        descripcion: string | null;
        estado: string;
        fecha: Date;
        origen_cci: string;
        destino_cci: string;
        destino_nombres: string;
        destino_apellidos: string;
        ordenante_nombres: string;
        ordenante_apellidos: string;
      }[]
    >`
      SELECT x.* FROM (
        SELECT 'INTERNA' AS tipo, t.id::text AS id, t.monto, t.moneda, t.descripcion, t.estado, t.fecha_creacion AS fecha,
               o.cci AS origen_cci, d.cci AS destino_cci, pd.nombres AS destino_nombres, pd.apellidos AS destino_apellidos,
               po.nombres AS ordenante_nombres, po.apellidos AS ordenante_apellidos, o.id_cliente
        FROM transferencia_internas t
        JOIN cuenta o ON o.id = t.id_cuenta_origen JOIN cuenta d ON d.id = t.id_cuenta_destino
        JOIN cliente po ON po.id = o.id_cliente JOIN cliente pd ON pd.id = d.id_cliente
        WHERE t.id = ${transferId}::uuid
        UNION ALL
        SELECT 'TERCEROS', t.id::text, t.monto, t.moneda, t.descripcion, t.estado, t.fecha_creacion,
               o.cci, d.cci, pd.nombres, pd.apellidos, po.nombres, po.apellidos, o.id_cliente
        FROM transferencia_externa t
        JOIN cuenta o ON o.id = t.id_cuenta_origen JOIN cuenta d ON d.id = t.id_cuenta_destino
        JOIN cliente po ON po.id = o.id_cliente JOIN cliente pd ON pd.id = d.id_cliente
        WHERE t.id = ${transferId}::uuid
      ) x
      WHERE x.id_cliente = ${clienteId}::uuid
      LIMIT 1`;
    const r = rows[0];
    if (!r) throw new NotFoundException('Constancia no encontrada');
    return {
      operationId: r.id,
      reference: referenceOf(r.id),
      type: r.tipo === 'INTERNA' ? 'Transferencia entre cuentas propias' : 'Transferencia a terceros',
      dateTime: r.fecha.toISOString(),
      amount: r.monto.toFixed(2),
      currency: r.moneda,
      amountFormatted: formatMoney(r.monto, r.moneda),
      status: r.estado,
      description: r.descripcion ?? '',
      source: { maskedNumber: maskCci(r.origen_cci), holder: maskHolder(`${r.ordenante_nombres} ${r.ordenante_apellidos}`) },
      destination: { maskedNumber: maskCci(r.destino_cci), holder: maskHolder(`${r.destino_nombres} ${r.destino_apellidos}`) },
    };
  }
}
