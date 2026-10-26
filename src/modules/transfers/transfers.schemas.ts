import { z } from 'zod';

export const createTransferBodySchema = z
  .object({
    source_account_id: z.string().uuid('source_account_id must be a valid UUID'),
    destination_account_id: z.string().uuid('destination_account_id must be a valid UUID'),
    amount: z
      .number({ invalid_type_error: 'amount must be a number' })
      .int('amount must be an integer (minor currency units)')
      .positive('amount must be greater than 0'),
    description: z.string().trim().max(500).optional(),
    reference_id: z.string().trim().min(1, 'reference_id is required'),
  })
  .transform((body) => ({
    sourceAccountId: body.source_account_id,
    destinationAccountId: body.destination_account_id,
    amount: body.amount,
    description: body.description,
    referenceId: body.reference_id,
  }));

export type CreateTransferInput = z.infer<typeof createTransferBodySchema>;
