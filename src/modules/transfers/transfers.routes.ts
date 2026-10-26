import type { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/database/prisma.js';
import { parseOrThrow } from '../../shared/validation/validate.js';
import { serializeTransfer, serializeTransaction } from '../../shared/http/serialize.js';
import { TransfersService } from './transfers.service.js';
import { createTransferBodySchema } from './transfers.schemas.js';

export async function registerTransferRoutes(app: FastifyInstance): Promise<void> {
  const transfers = new TransfersService(prisma);

  app.post('/transfers', {
    schema: {
      tags: ['transfers'],
      summary: 'Atomically transfer money between two accounts',
      body: {
        type: 'object',
        required: ['source_account_id', 'destination_account_id', 'amount', 'reference_id'],
        properties: {
          source_account_id: { type: 'string', format: 'uuid' },
          destination_account_id: { type: 'string', format: 'uuid' },
          amount: { type: 'integer', minimum: 1, example: 3000 },
          description: { type: 'string', example: 'Rent contribution' },
          reference_id: { type: 'string', example: 'transfer-001' },
        },
      },
    },
    handler: async (request, reply) => {
      const input = parseOrThrow(createTransferBodySchema, request.body);
      const { transfer, debit, credit } = await transfers.create(input);
      return reply.status(201).send({
        ...serializeTransfer(transfer),
        entries: [serializeTransaction(debit), serializeTransaction(credit)],
      });
    },
  });
}
