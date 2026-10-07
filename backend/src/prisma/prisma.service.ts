import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { auditStorage } from '../common/audit-context';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Transaccion interactiva (READ COMMITTED + locks de fila explicitos en los servicios).
   * Inyecta el usuario de la peticion para los triggers de auditoria (set_config local a la tx).
   */
  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const usuario = auditStorage.getStore() ?? 'SYSTEM_UNKNOWN';
    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('request.jwt.claim.username', ${usuario}, true)`;
        return fn(tx);
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
}
