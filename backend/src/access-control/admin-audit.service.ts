import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, Tx } from '../prisma/prisma.service';

export interface AdminAuditEntry {
  actorId: string;
  action: string;
  objectType: string;
  objectId?: string | null;
  result: 'EXITO' | 'DENEGADO' | 'ERROR';
  /** Estado de negocio antes/despues (p. ej. roles). Jamas credenciales ni datos personales. */
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Bitacora de acciones administrativas (tabla auditoria_admin, solo insercion). */
@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Dentro de la transaccion del cambio: si no se puede auditar, el cambio tampoco se aplica. */
  async record(entry: AdminAuditEntry, tx: Tx): Promise<void> {
    await this.insert(tx, entry);
  }

  /** Para denegaciones y errores (fuera de transaccion): nunca debe romper la respuesta al cliente. */
  async recordSafe(entry: AdminAuditEntry): Promise<void> {
    try {
      await this.insert(this.prisma, entry);
    } catch (e) {
      // Solo el nombre del error: el mensaje podria contener valores de la consulta.
      this.logger.error(`No se pudo registrar la auditoria administrativa (${(e as Error)?.name ?? 'error'})`);
    }
  }

  private async insert(client: Tx | PrismaService, e: AdminAuditEntry): Promise<void> {
    const before = e.before === undefined ? null : JSON.stringify(e.before);
    const after = e.after === undefined ? null : JSON.stringify(e.after);
    await client.$executeRaw`
      INSERT INTO auditoria_admin (id_actor, accion, objeto_tipo, objeto_id, resultado, valor_anterior, valor_nuevo, ip_origen)
      VALUES (${e.actorId}::uuid, ${e.action}, ${e.objectType}, ${e.objectId ?? null}, ${e.result},
              ${before}::jsonb, ${after}::jsonb, ${e.ip ?? null})`;
  }
}
