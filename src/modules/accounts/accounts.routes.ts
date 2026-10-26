import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma.js';
import { parseOrThrow } from '../../shared/validation/validate.js';
import { serializeAccount } from '../../shared/http/serialize.js';
import { AccountsService } from './accounts.service.js';
import { accountIdParamsSchema, createAccountBodySchema } from './accounts.schemas.js';

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  const accounts = new AccountsService(prisma);

  app.post('/accounts', {
    schema: {
      tags: ['accounts'],
      summary: 'Create an account',
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', example: 'Aarav Sharma' } },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            balance: { type: 'integer' },
            created_at: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { name } = parseOrThrow(createAccountBodySchema, request.body);
      const account = await accounts.create(name);
      return reply.status(201).send(serializeAccount(account));
    },
  });

  app.get('/accounts/:accountId/balance', {
    schema: {
      tags: ['accounts'],
      summary: 'Get account balance',
      params: {
        type: 'object',
        properties: { accountId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            balance: { type: 'integer' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { accountId } = parseOrThrow(accountIdParamsSchema, request.params);
      const account = await accounts.getOrThrow(accountId);
      return reply.status(200).send({
        account_id: account.id,
        balance: Number(account.balance),
      });
    },
  });
}
