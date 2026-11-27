import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { Prisma } from '@prisma/client';
import { CreateAccountDto } from './dto/create-account.dto';
import { RechargeAccountDto } from './dto/recharge-account.dto';
import { AdminAuditService } from '../access-control/admin-audit.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { businessError } from '../common/business-error';
import { maskCci } from '../common/masking';
import { formatMoney } from '../common/money';
import { limits } from '../common/config';
import {
  beginIdempotent,
  completeIdempotent,
  hashRequest,
  requireIdempotencyKey,
} from '../common/idempotency';
import { AuthUser } from '../auth/decorators/current-user.decorator';

/** DTO del dashboard (HU06). Nunca incluye el CCI completo ni datos de otros clientes. */
export interface Account {
  id: string;
  label: string;
  type: 'savings' | 'checking' | 'usd';
  balance: string;
  numericBalance: number;
  detail: string;
  subtitleDetail: string;
  icon: 'wallet' | 'savings' | 'investment';
  currency: 'PEN' | 'USD';
  maskedNumber: string;
  /** Compatibilidad con el contrato previo: ahora enmascarado (****1234). */
  cci: string;
  /** CCI completo sin enmascarar, disponible para el titular en detalle de cuenta (HU07). */
  fullCci?: string;
  status: 'active' | 'blocked';
  openedAt: string;
  trendLabel: string;
  trendDirection: 'up' | 'down';
}

export interface Movement {
  id: string;
  name: string;
  description: string;
  date: string;
  category: string;
  amount: string;
  type: 'positive' | 'negative';
}

interface CuentaRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  moneda: string;
  cci: string;
  saldo: any;
  estado_cuenta: string;
  fecha_apertura: Date;
}

const SUBTITLE: Record<string, string> = {
  savings: 'Interés anual: 3.5% TEA',
  checking: 'Sin comisión de mantenimiento',
  usd: 'TC referencial: S/. 3.78',
};
const ICON: Record<string, Account['icon']> = { savings: 'savings', checking: 'wallet', usd: 'investment' };

export function toAccountDto(r: CuentaRow): Account {
  return {
    id: r.id,
    label: r.nombre,
    type: r.codigo as Account['type'],
    balance: formatMoney(r.saldo, r.moneda),
    numericBalance: Number(r.saldo),
    detail: r.descripcion ?? '',
    subtitleDetail: SUBTITLE[r.codigo] ?? '',
    icon: ICON[r.codigo] ?? 'wallet',
    currency: r.moneda as Account['currency'],
    maskedNumber: maskCci(r.cci),
    cci: maskCci(r.cci),
    status: r.estado_cuenta === 'ACTIVA' ? 'active' : 'blocked',
    openedAt: r.fecha_apertura.toISOString(),
    trendLabel: '',
    trendDirection: 'up',
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  /** HU06: una sola consulta (JOIN a tipo_cuenta), filtrada por el cliente autenticado. */
  async getAccounts(clienteId: string): Promise<Account[]> {
    const rows = await this.prisma.$queryRaw<CuentaRow[]>`
      SELECT c.id::text AS id, t.codigo, t.nombre, t.descripcion, c.moneda, c.cci, c.saldo,
             c.estado_cuenta, c.fecha_apertura
      FROM cuenta c
      JOIN tipo_cuenta t ON t.id = c.id_tipo_cuenta
      WHERE c.id_cliente = ${clienteId}::uuid AND c.estado_cuenta <> 'CERRADA'
      ORDER BY c.fecha_apertura ASC, c.id ASC`;
    return rows.map(toAccountDto);
  }

  /**
   * HU07: ownership en la propia consulta (id + id_cliente). Cuenta inexistente y cuenta ajena
   * responden igual (404) para no permitir enumerar cuentas de otros clientes.
   */
  async getOwnedAccount(clienteId: string, accountId: string): Promise<Account> {
    if (!isUuid(accountId)) throw new NotFoundException('Cuenta no encontrada');
    const rows = await this.prisma.$queryRaw<CuentaRow[]>`
      SELECT c.id::text AS id, t.codigo, t.nombre, t.descripcion, c.moneda, c.cci, c.saldo,
             c.estado_cuenta, c.fecha_apertura
      FROM cuenta c
      JOIN tipo_cuenta t ON t.id = c.id_tipo_cuenta
      WHERE c.id = ${accountId}::uuid AND c.id_cliente = ${clienteId}::uuid`;
    if (!rows.length) throw new NotFoundException('Cuenta no encontrada');
    return {
      ...toAccountDto(rows[0]),
      fullCci: rows[0].cci,
    };
  }

  /** HU05: apertura transaccional, con proteccion contra duplicados y carreras. */
  async createAccount(user: AuthUser, dto: CreateAccountDto, idempotencyKey?: string): Promise<Account> {
    const key = requireIdempotencyKey(idempotencyKey);

    if (dto.type === 'usd' && dto.currency !== 'USD') {
      throw businessError(422, 'INVALID_ACCOUNT_CURRENCY', 'La cuenta en dólares debe abrirse en moneda USD.');
    }

    const hash = hashRequest({ type: dto.type, currency: dto.currency });

    return this.prisma.transaction(async (tx) => {
      // Serializa aperturas concurrentes del mismo cliente (regla de maximo de cuentas sin carreras).
      const cliente = await tx.$queryRaw<{ estado: string }[]>`
        SELECT estado FROM cliente WHERE id = ${user.id}::uuid FOR UPDATE`;
      if (!cliente.length || cliente[0].estado !== 'ACTIVO') {
        throw businessError(403, 'CLIENT_NOT_ACTIVE', 'Tu usuario no está habilitado para abrir cuentas.');
      }

      const idem = await beginIdempotent(tx, user.id, 'ACCOUNT_OPEN', key, hash);
      if (!('id' in idem)) return idem.replay as Account;

      const tipo = await tx.tipo_cuenta.findUnique({ where: { codigo: dto.type } });
      if (!tipo) throw businessError(422, 'INVALID_ACCOUNT_TYPE', 'Tipo de cuenta no disponible.');

      // El Sprint no define el origen de fondos de un deposito inicial: la cuenta se abre con 0.
      if (Number(tipo.saldo_minimo_apertura) > 0) {
        throw businessError(
          422,
          'MIN_OPENING_BALANCE_REQUIRED',
          'Este tipo de cuenta requiere un saldo mínimo de apertura que aún no puede acreditarse.',
        );
      }

      const [{ total }] = await tx.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM cuenta
        WHERE id_cliente = ${user.id}::uuid AND estado_cuenta <> 'CERRADA'`;
      if (total >= limits.maxAccountsPerClient()) {
        throw businessError(422, 'ACCOUNT_LIMIT_REACHED', 'Alcanzaste el máximo de cuentas permitidas.');
      }

      const created = await this.insertAccount(tx, user.id, tipo.id, dto.currency);
      const dtoOut: Account = {
        ...toAccountDto({
          ...created,
          codigo: tipo.codigo,
          nombre: tipo.nombre,
          descripcion: 'Cuenta recién abierta',
        }),
        fullCci: created.cci,
      };
      await completeIdempotent(tx, idem.id, created.id, dtoOut);
      return dtoOut;
    });
  }

  private async insertAccount(tx: Tx, clienteId: string, tipoId: number, moneda: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const cci = this.generateCci();
      const rows = await tx.$queryRaw<CuentaRow[]>`
        INSERT INTO cuenta (id_cliente, id_tipo_cuenta, moneda, cci, saldo, estado_cuenta)
        VALUES (${clienteId}::uuid, ${tipoId}::smallint, ${moneda}, ${cci}, 0, 'ACTIVA')
        ON CONFLICT (cci) DO NOTHING
        RETURNING id::text AS id, ''::text AS codigo, ''::text AS nombre, NULL::text AS descripcion,
                  moneda, cci, saldo, estado_cuenta, fecha_apertura`;
      if (rows.length) return rows[0];
    }
    throw businessError(500, 'ACCOUNT_NUMBER_UNAVAILABLE', 'No se pudo generar el número de cuenta. Intenta nuevamente.');
  }

  private generateCci(): string {
    const body = Array.from({ length: 10 }, () => randomInt(0, 10)).join('');
    const tail = Array.from({ length: 2 }, () => randomInt(0, 10)).join('');
    return `191-${body}-${tail}`;
  }

  async countAccounts(): Promise<number> {
    return this.prisma.cuenta.count();
  }

  /**
   * SCRUM-91: Recargar cuenta de usuario (simulación de depósito en cajero automático/ventanilla).
   * Bloquea la fila de la cuenta con FOR UPDATE, valida que la cuenta y el cliente estén activos,
   * suma el saldo, registra el movimiento contable tipo CREDITO y audita la acción.
   */
  async rechargeAccount(
    actor: AuthUser,
    accountIdOrCci: string | undefined,
    dto: RechargeAccountDto,
    idempotencyKey?: string,
    ip?: string,
  ) {
    const target = accountIdOrCci?.trim() || dto.cci?.trim();
    if (!target) {
      throw businessError(400, 'ACCOUNT_TARGET_REQUIRED', 'Debes especificar el ID o el CCI de la cuenta a recargar.');
    }

    const key = idempotencyKey?.trim() ? requireIdempotencyKey(idempotencyKey) : undefined;
    const hash = key ? hashRequest({ target, amount: dto.amount, description: dto.description }) : undefined;

    return this.prisma.transaction(async (tx) => {


      type AccountLockRow = {
        id: string;
        id_cliente: string;
        moneda: string;
        cci: string;
        saldo: Prisma.Decimal;
        estado_cuenta: string;
        cliente_estado: string;
      };

      let rows: AccountLockRow[] = [];
      if (isUuid(target)) {
        rows = await tx.$queryRaw<AccountLockRow[]>`
          SELECT c.id::text, c.id_cliente::text, c.moneda, c.cci, c.saldo, c.estado_cuenta, cl.estado AS cliente_estado
          FROM cuenta c
          JOIN cliente cl ON cl.id = c.id_cliente
          WHERE c.id = ${target}::uuid FOR UPDATE`;
      } else {
        rows = await tx.$queryRaw<AccountLockRow[]>`
          SELECT c.id::text, c.id_cliente::text, c.moneda, c.cci, c.saldo, c.estado_cuenta, cl.estado AS cliente_estado
          FROM cuenta c
          JOIN cliente cl ON cl.id = c.id_cliente
          WHERE c.cci = ${target} FOR UPDATE`;
      }

      if (!rows.length) {
        throw new NotFoundException('Cuenta no encontrada.');
      }
      const acc = rows[0];

      let idem: any;
      if (key && hash) {
        idem = await beginIdempotent(tx, acc.id_cliente, 'ACCOUNT_RECHARGE', key, hash);
        if (!('id' in idem)) return idem.replay;
      }

      if (actor.role === 'client' && acc.id_cliente !== actor.id) {
        throw new NotFoundException('Cuenta no encontrada.');
      }

      if (acc.estado_cuenta !== 'ACTIVA') {
        throw businessError(422, 'ACCOUNT_NOT_ACTIVE', 'La cuenta bancaria se encuentra inactiva o bloqueada.');
      }
      if (acc.cliente_estado !== 'ACTIVO') {
        throw businessError(422, 'CLIENT_NOT_ACTIVE', 'El titular de la cuenta se encuentra bloqueado o inactivo.');
      }

      const prevBalance = Number(acc.saldo);
      const newBalance = Number((prevBalance + dto.amount).toFixed(2));
      const description = dto.description?.trim() || 'Depósito en efectivo (Cajero automático BankHub)';

      await tx.$executeRaw`
        UPDATE cuenta
        SET saldo = saldo + ${dto.amount}::numeric, fecha_actualizacion = NOW()
        WHERE id = ${acc.id}::uuid`;

      const movRows = await tx.$queryRaw<{ id: string; fecha: Date }[]>`
        INSERT INTO movimiento (id_cuenta, tipo, categoria, monto, saldo_posterior, descripcion, fecha)
        VALUES (${acc.id}::uuid, 'CREDITO', 'Recarga', ${dto.amount}::numeric, ${newBalance}::numeric, ${description}, NOW())
        RETURNING id::text AS id, fecha`;
      const mov = movRows[0];

      const result = {
        success: true,
        movementId: mov.id,
        accountId: acc.id,
        cci: acc.cci,
        maskedCci: maskCci(acc.cci),
        amount: formatMoney(dto.amount, acc.moneda),
        numericAmount: dto.amount,
        newBalance: formatMoney(newBalance, acc.moneda),
        numericBalance: newBalance,
        currency: acc.moneda,
        date: mov.fecha.toISOString(),
        description,
      };

      if (actor.role === 'admin') {
        await this.audit.record(
          {
            actorId: actor.id,
            action: 'CUENTA_RECARGAR',
            objectType: 'CUENTA',
            objectId: acc.id,
            result: 'EXITO',
            before: { saldo: prevBalance, estado: acc.estado_cuenta },
            after: { saldo: newBalance, recarga: dto.amount, cci: acc.cci },
            ip,
          },
          tx,
        );
      }

      if (idem?.id) {
        await completeIdempotent(tx, idem.id, mov.id, result);
      }

      return result;
    });
  }

}
