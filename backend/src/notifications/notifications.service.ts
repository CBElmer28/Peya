import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { maskCci } from '../common/masking';
import { isUuid } from '../accounts/accounts.service';
import { PageQueryDto } from '../accounts/dto/movements-query.dto';

/** Contrato consumido por el front (AppNotification). Solo notificaciones de transferencia recibida. */
export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  unread: boolean;
  type: 'transfer';
  transferOrigin: string;
  amount: string;
  currency: 'PEN' | 'USD';
  date: string;
  receivingAccount: string;
}

interface NotificationRow {
  id: string;
  titulo: string;
  detalle: string;
  leida: boolean;
  monto: unknown;
  moneda: string;
  fecha: Date;
  nombres: string;
  apellidos: string;
  cci_origen: string;
  cci_destino: string;
}

// Los datos de la operacion salen de la transferencia confirmada; el filtro por n.id_cliente
// (tomado del JWT) es la unica puerta de acceso a las filas. Nunca se expone saldo, DNI ni CCI completo.
const SELECT_NOTIFICATION = `
  SELECT n.id::text AS id, n.titulo, n.detalle, n.leida,
         te.monto, te.moneda, te.fecha_creacion AS fecha,
         rem.nombres, rem.apellidos, o.cci AS cci_origen, d.cci AS cci_destino
  FROM notificacion n
  JOIN transferencia_externa te ON te.id = n.id_transferencia_externa AND te.estado = 'COMPLETADO'
  JOIN cuenta o ON o.id = te.id_cuenta_origen
  JOIN cliente rem ON rem.id = o.id_cliente
  JOIN cuenta d ON d.id = n.id_cuenta_destino`;

function toDto(r: NotificationRow): AppNotification {
  const sender = `${r.nombres} ${r.apellidos}`.trim();
  return {
    id: r.id,
    title: r.titulo,
    detail: r.detalle,
    unread: !r.leida,
    type: 'transfer',
    transferOrigin: `${sender} · Cuenta ${maskCci(r.cci_origen)}`,
    amount: Number(r.monto).toFixed(2),
    currency: r.moneda as 'PEN' | 'USD',
    date: r.fecha.toISOString(),
    receivingAccount: maskCci(r.cci_destino),
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clienteId: string, query: PageQueryDto): Promise<AppNotification[]> {
    const pageSize = query.pageSize ?? 20;
    const offset = ((query.page ?? 1) - 1) * pageSize;
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    const rows = await this.prisma.$queryRawUnsafe<NotificationRow[]>(
      `${SELECT_NOTIFICATION}
       WHERE n.id_cliente = $1::uuid
       ORDER BY n.fecha_creacion ${direction}, n.id DESC
       LIMIT $2 OFFSET $3`,
      clienteId,
      pageSize,
      offset,
    );
    return rows.map(toDto);
  }

  /** 404 uniforme si no existe o es de otro cliente: no se revela cual de los dos casos es. */
  async getOwned(clienteId: string, id: string): Promise<AppNotification> {
    if (!isUuid(id)) throw new NotFoundException('Notificación no encontrada');
    const rows = await this.prisma.$queryRawUnsafe<NotificationRow[]>(
      `${SELECT_NOTIFICATION} WHERE n.id = $1::uuid AND n.id_cliente = $2::uuid`,
      id,
      clienteId,
    );
    if (!rows.length) throw new NotFoundException('Notificación no encontrada');
    return toDto(rows[0]);
  }

  async markRead(clienteId: string, id: string): Promise<AppNotification> {
    if (!isUuid(id)) throw new NotFoundException('Notificación no encontrada');
    const updated = await this.prisma.$executeRaw`
      UPDATE notificacion SET leida = TRUE WHERE id = ${id}::uuid AND id_cliente = ${clienteId}::uuid`;
    if (!updated) throw new NotFoundException('Notificación no encontrada');
    return this.getOwned(clienteId, id);
  }

  async markAllRead(clienteId: string): Promise<{ updated: number }> {
    const updated = await this.prisma.$executeRaw`
      UPDATE notificacion SET leida = TRUE WHERE id_cliente = ${clienteId}::uuid AND leida = FALSE`;
    return { updated };
  }
}
