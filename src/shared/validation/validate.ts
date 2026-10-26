import { z, ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../errors/app-error.js';

/** Flattens a ZodError into the error envelope's `details` field. */
export function zodIssues(error: ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Parses `data` with `schema`, converting any validation failure into a
 * 422 VALIDATION_ERROR AppError so the error handler can render it uniformly.
 */
export function parseOrThrow<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      'Request validation failed.',
      zodIssues(result.error),
    );
  }
  return result.data;
}
