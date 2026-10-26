import { z } from 'zod';

/**
 * Only `name` is accepted. Any id/balance/created_at a client sends is stripped
 * (Zod's default behavior for unknown keys), so the server always controls them.
 */
export const createAccountBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required and must not be blank'),
});

export type CreateAccountBody = z.infer<typeof createAccountBodySchema>;

export const accountIdParamsSchema = z.object({
  accountId: z.string().uuid('accountId must be a valid UUID'),
});

export type AccountIdParams = z.infer<typeof accountIdParamsSchema>;
