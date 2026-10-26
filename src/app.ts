import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { loadEnv } from './config/env.js';
import { registerErrorHandler } from './shared/errors/error-handler.js';
import { registerAccountRoutes } from './modules/accounts/accounts.routes.js';
import { registerTransactionRoutes } from './modules/transactions/transactions.routes.js';
import { registerTransferRoutes } from './modules/transfers/transfers.routes.js';

/**
 * Builds the Fastify instance with documentation, error handling, and routes.
 * Kept side-effect free (does not listen) so tests can drive it via `inject`.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const env = loadEnv();

  const app = Fastify({
    logger: env.LOG_LEVEL === 'silent' ? false : { level: env.LOG_LEVEL },
  });

  // Request validation is delegated entirely to Zod inside each handler so that
  // every validation failure produces one consistent 422 error envelope. The
  // `schema` blocks on routes therefore exist only to feed Swagger/OpenAPI; this
  // passthrough compiler stops Fastify from also validating (and from rejecting
  // the OpenAPI-only `example` keyword under AJV strict mode).
  app.setValidatorCompiler(() => () => true);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Transaction Ledger API',
        description:
          'Accounts, credit/debit transactions, and atomic transfers. Money is in integer minor currency units.',
        version: '1.0.0',
      },
      tags: [
        { name: 'accounts', description: 'Account creation and balance' },
        { name: 'transactions', description: 'Ledger entries and history' },
        { name: 'transfers', description: 'Atomic account-to-account transfers' },
      ],
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  registerErrorHandler(app);

  await app.register(registerAccountRoutes);
  await app.register(registerTransactionRoutes);
  await app.register(registerTransferRoutes);

  return app;
}
