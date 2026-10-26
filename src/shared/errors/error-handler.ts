import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { zodIssues } from '../validation/validate.js';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

function send(reply: FastifyReply, status: number, body: ErrorEnvelope): void {
  void reply.status(status).send(body);
}

/**
 * Translates every error into one consistent JSON envelope:
 *   { "error": { "code", "message", "details" } }
 *
 * Internal failures are logged in full but never leaked to the client.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      send(reply, error.statusCode, {
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    // Defensive: a Zod error that reached here unwrapped.
    if (error instanceof ZodError) {
      send(reply, 422, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: zodIssues(error),
        },
      });
      return;
    }

    // Fastify raises a 400 with an empty/invalid JSON body before routing.
    if (error.statusCode === 400) {
      send(reply, 400, {
        error: {
          code: 'MALFORMED_JSON',
          message: 'Request body is not valid JSON.',
          details: {},
        },
      });
      return;
    }

    request.log.error({ err: error }, 'Unhandled error');
    send(reply, 500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        details: {},
      },
    });
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    send(reply, 404, {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found.`,
        details: {},
      },
    });
  });
}
