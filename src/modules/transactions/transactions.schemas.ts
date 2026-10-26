import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/http/pagination.js';

export const createTransactionBodySchema = z
  .object({
    type: z.enum(['credit', 'debit'], {
      errorMap: () => ({ message: "type must be 'credit' or 'debit'" }),
    }),
    amount: z
      .number({ invalid_type_error: 'amount must be a number' })
      .int('amount must be an integer (minor currency units)')
      .positive('amount must be greater than 0'),
    description: z.string().trim().max(500).optional(),
    reference_id: z.string().trim().min(1, 'reference_id is required'),
  })
  .transform((body) => ({
    type: body.type,
    amount: body.amount,
    description: body.description,
    referenceId: body.reference_id,
  }));

export type CreateTransactionInput = z.infer<typeof createTransactionBodySchema>;

export function transactionHistoryQuerySchema(maxPageSize: number) {
  return paginationQuerySchema(maxPageSize).extend({
    type: z.enum(['credit', 'debit']).optional(),
  });
}
