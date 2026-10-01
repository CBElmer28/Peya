import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { businessError } from '../common/business-error';
import { maskCci } from '../common/masking';
import { formatMoney } from '../common/money';
import { MovementsQueryDto, PageQueryDto } from './dto/movements-query.dto';
import { isUuid, Movement } from './accounts.service';

export interface MovementItem {
  id: string;
  accountId: string;
  accountMasked: string;
  type: 'CREDITO' | 'DEBITO';
  category: string;
  description: string;
  amount: string;
  currency: string;
  balanceAfter: string;
  date: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface MovRow {
  id: string;
  account_id: string;
  cci: string;
  tipo: 'CREDITO' | 'DEBITO';
  categoria: string;
  descripcion: string;
  monto: Prisma.Decimal;
  moneda: string;
  saldo_posterior: Prisma.Decimal;
  fecha: Date;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * HU08. La autorizacion forma parte de la consulta: JOIN cuenta + c.id_cliente = <JWT>.
   * Si se envia accountId ajeno el resultado es 404 (indistinguible de inexistente).
   */
  async search(clienteId: string, q: MovementsQueryDto): Promise<Page<MovementItem>> {
    if (q.from && q.to && q.from > q.to) {
      throw businessError(400, 'INVALID_DATE_RANGE', 'La fecha inicial no puede ser mayor que la final.');
    }
    if (q.minAmount != null && q.maxAmount != null && q.minAmount > q.maxAmount) {
      throw businessError(400, 'INVALID_AMOUNT_RANGE', 'El monto mínimo no puede ser mayor que el máximo.');
    }
    for (const d of [q.from, q.to]) {
      if (d && Number.isNaN(Date.parse(`${d}T00:00:00Z`))) {
        throw businessError(400, 'INVALID_DATE', 'Fecha inválida.');
      }
    }

    const conds: Prisma.Sql[] = [Prisma.sql`c.id_cliente = ${clienteId}::uuid`];
    if (q.accountId) conds.push(Prisma.sql`m.id_cuenta = ${q.accountId}::uuid`);
    if (q.from) conds.push(Prisma.sql`m.fecha >= ${q.from}::date`);
    if (q.to) conds.push(Prisma.sql`m.fecha < (${q.to}::date + 1)`);
    if (q.type) conds.push(Prisma.sql`m.tipo = ${q.type}`);
    if (q.minAmount != null) conds.push(Prisma.sql`m.monto >= ${q.minAmount}`);
    if (q.maxAmount != null) conds.push(Prisma.sql`m.monto <= ${q.maxAmount}`);
    if (q.q) conds.push(Prisma.sql`m.descripcion ILIKE ${'%' + escapeLike(q.q.trim()) + '%'}`);

    return this.runPage(clienteId, conds, q, q.accountId);
  }

  /** HU07: movimientos de UNA cuenta, previa verificacion de ownership. */
  async listForAccount(clienteId: string, accountId: string, q: PageQueryDto): Promise<Page<MovementItem>> {
    if (!isUuid(accountId)) throw new NotFoundException('Cuenta no encontrada');
    const conds = [Prisma.sql`c.id_cliente = ${clienteId}::uuid`, Prisma.sql`m.id_cuenta = ${accountId}::uuid`];
    return this.runPage(clienteId, conds, q, accountId);
  }

  private async runPage(
    clienteId: string,
    conds: Prisma.Sql[],
    q: PageQueryDto,
    accountId?: string,
  ): Promise<Page<MovementItem>> {
    if (accountId) {
      // Ownership por PK + cliente: cuenta ajena e inexistente responden igual (404).
      const own = await this.prisma.$queryRaw<{ ok: number }[]>`
        SELECT 1 AS ok FROM cuenta WHERE id = ${accountId}::uuid AND id_cliente = ${clienteId}::uuid`;
      if (!own.length) throw new NotFoundException('Cuenta no encontrada');
    }
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where = Prisma.join(conds, ' AND ');
    const dir = q.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<MovRow[]>`
        SELECT m.id::text AS id, m.id_cuenta::text AS account_id, c.cci, m.tipo, m.categoria,
               m.descripcion, m.monto, c.moneda, m.saldo_posterior, m.fecha
        FROM movimiento m
        JOIN cuenta c ON c.id = m.id_cuenta
        WHERE ${where}
        ORDER BY m.fecha ${dir}, m.id ${dir}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM movimiento m JOIN cuenta c ON c.id = m.id_cuenta
        WHERE ${where}`,
    ]);

    const total = count[0]?.total ?? 0;
    return {
      items: rows.map((r) => ({
        id: r.id,
        accountId: r.account_id,
        accountMasked: maskCci(r.cci),
        type: r.tipo,
        category: r.categoria,
        description: r.descripcion,
        amount: r.monto.toFixed(2),
        currency: r.moneda,
        balanceAfter: r.saldo_posterior.toFixed(2),
        date: r.fecha.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Contrato previo de GET /accounts/movements (lista simple), ahora autenticado y por cliente. */
  async getLegacyMovements(clienteId: string): Promise<Movement[]> {
    const rows = await this.prisma.$queryRaw<MovRow[]>`
      SELECT m.id::text AS id, m.id_cuenta::text AS account_id, c.cci, m.tipo, m.categoria,
             m.descripcion, m.monto, c.moneda, m.saldo_posterior, m.fecha
      FROM movimiento m JOIN cuenta c ON c.id = m.id_cuenta
      WHERE c.id_cliente = ${clienteId}::uuid
      ORDER BY m.fecha DESC, m.id DESC
      LIMIT 50`;
    return rows.map((r) => ({
      id: r.id,
      name: r.descripcion,
      description: `${r.categoria} · ${maskCci(r.cci)}`,
      date: r.fecha.toLocaleDateString('es-PE'),
      category: r.categoria,
      amount: `${r.tipo === 'CREDITO' ? '+' : '-'}${formatMoney(r.monto, r.moneda)}`,
      type: r.tipo === 'CREDITO' ? 'positive' : 'negative',
    }));
  }
}
