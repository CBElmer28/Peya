import { AsyncLocalStorage } from 'async_hooks';

// Usuario de la peticion HTTP activa; lo consume PrismaService para los triggers de auditoria.
export const auditStorage = new AsyncLocalStorage<string>();
