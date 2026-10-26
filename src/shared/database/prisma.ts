import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient per process. Reusing one client keeps a single
 * connection pool; creating clients per request would exhaust connections.
 */
export const prisma = new PrismaClient();

export type { PrismaClient };

/**
 * The transaction client type passed to interactive-transaction callbacks.
 * Exposed so services can type the `tx` handle they receive.
 */
export type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
