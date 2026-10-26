import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma.js';
import { loadEnv } from '../../config/env.js';
import { parseOrThrow } from '../../shared/validation/validate.js';
import { serializeTransaction } from '../../shared/http/serialize.js';
import { buildPaginationMeta } from '../../shared/http/pagination.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { accountIdParamsSchema } from '../accounts/accounts.schemas.js';
import { TransactionsService } from './transactions.service.js';
import {
  createTransactionBodySchema,
  transactionHistoryQuerySchema,
} from './transactions.schemas.js';

export async function registerTransactionRoutes(app: FastifyInstance): Promise<void> {
  const env = loadEnv();
  const transactions = new TransactionsService(prisma);
  const accounts = new AccountsService(prisma);
  const historyQuerySchema = transactionHistoryQuerySchema(env.MAX_PAGE_SIZE);

  app.post('/accounts/:accountId/transactions', {
    schema: {
      tags: ['transactions'],
      summary: 'Add a credit or debit transaction',
      params: {
        type: 'object',
        properties: { accountId: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['type', 'amount', 'reference_id'],
        properties: {
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: { type: 'integer', minimum: 1, example: 5000 },
          description: { type: 'string', example: 'Opening deposit' },
          reference_id: { type: 'string', example: 'deposit-001' },
        },
      },
    },
    handler: async (request, reply) => {
      const { accountId } = parseOrThrow(accountIdParamsSchema, request.params);
      const input = parseOrThrow(createTransactionBodySchema, request.body);
      const created = await transactions.create(accountId, input);
      return reply.status(201).send(serializeTransaction(created));
    },
  });

  app.get('/accounts/:accountId/transactions', {
    schema: {
      tags: ['transactions'],
      summary: 'List transactions (newest first) with filtering and pagination',
      params: {
        type: 'object',
        properties: { accountId: { type: 'string', format: 'uuid' } },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, default: 20 },
          type: { type: 'string', enum: ['credit', 'debit'] },
        },
      },
    },
    handler: async (request, reply) => {
      const { accountId } = parseOrThrow(accountIdParamsSchema, request.params);
      const query = parseOrThrow(historyQuerySchema, request.query);

      // A missing account is a 404 even when the filter would be empty anyway.
      await accounts.getOrThrow(accountId);

      const { records, totalRecords } = await transactions.history(accountId, query);
      return reply.status(200).send({
        data: records.map(serializeTransaction),
        pagination: buildPaginationMeta(query.page, query.limit, totalRecords),
      });
    },
  });
}
