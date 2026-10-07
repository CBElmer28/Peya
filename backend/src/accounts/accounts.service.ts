import { Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { CreateAccountDto } from './dto/create-account.dto';
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

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  unread: boolean;
  type: 'transfer' | 'login' | 'document' | 'payment' | 'alert' | 'deposit';
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
  constructor(private readonly prisma: PrismaService) {}

  private notifications: AppNotification[] = [
    { id: 'not-1', title: 'Pago recibido de Cliente ACME', detail: 'Hace 10 min', unread: true, type: 'payment' },
    { id: 'not-2', title: 'Recordatorio: factura por vencer', detail: 'Hace 1 hora', unread: false, type: 'alert' },
    { id: 'not-3', title: 'Nuevo dispositivo inició sesión', detail: 'Hace 3 horas', unread: true, type: 'login' },
    { id: 'not-4', title: 'Tu reporte mensual está listo', detail: 'Ayer', unread: false, type: 'document' },
  ];

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
    return toAccountDto(rows[0]);
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
      const dtoOut = toAccountDto({
        ...created,
        codigo: tipo.codigo,
        nombre: tipo.nombre,
        descripcion: 'Cuenta recién abierta',
      });
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

  async getNotifications(): Promise<AppNotification[]> {
    return this.notifications;
  }
}
