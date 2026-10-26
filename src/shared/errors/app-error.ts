/**
 * Stable, documented error codes. These are part of the API contract and map
 * one-to-one to an HTTP status code.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'MALFORMED_JSON'
  | 'ACCOUNT_NOT_FOUND'
  | 'DUPLICATE_REFERENCE'
  | 'DUPLICATE_TRANSFER'
  | 'INSUFFICIENT_BALANCE'
  | 'SAME_ACCOUNT_TRANSFER'
  | 'INTERNAL_ERROR';

/**
 * An error that carries an HTTP status and a machine-readable code. The global
 * error handler turns any AppError into the consistent JSON error envelope.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const accountNotFound = (accountId: string): AppError =>
  new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found.', { account_id: accountId });

export const duplicateReference = (accountId: string, referenceId: string): AppError =>
  new AppError(
    409,
    'DUPLICATE_REFERENCE',
    'A transaction with this reference_id already exists for this account.',
    { account_id: accountId, reference_id: referenceId },
  );

export const duplicateTransfer = (referenceId: string): AppError =>
  new AppError(409, 'DUPLICATE_TRANSFER', 'A transfer with this reference_id already exists.', {
    reference_id: referenceId,
  });

export const insufficientBalance = (accountId: string, balance: number, amount: number): AppError =>
  new AppError(409, 'INSUFFICIENT_BALANCE', 'The account does not have enough balance.', {
    account_id: accountId,
    balance,
    amount,
  });

export const sameAccountTransfer = (): AppError =>
  new AppError(422, 'SAME_ACCOUNT_TRANSFER', 'Source and destination accounts must be different.');
