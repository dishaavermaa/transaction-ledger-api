/**
 * Typed client for the Transaction Ledger API. Types mirror the backend's
 * serialized shapes exactly. Every `amount`/`balance` is integer minor units.
 */

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export type TransactionType = 'credit' | 'debit';

export interface Account {
  id: string;
  name: string;
  balance: number;
  created_at: string;
}

export interface Balance {
  account_id: string;
  balance: number;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  reference_id: string;
  transfer_id: string | null;
  created_at: string;
}

export interface Pagination {
  current_page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
}

export interface TransactionPage {
  data: Transaction[];
  pagination: Pagination;
}

export interface Transfer {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  description: string | null;
  reference_id: string;
  created_at: string;
  entries: Transaction[];
}

/** Mirrors the backend envelope `{ error: { code, message, details } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    // Network / CORS failure: no HTTP response at all.
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the API. Is the server running?');
  }

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const envelope = (body as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })
      ?.error;
    throw new ApiError(
      res.status,
      envelope?.code ?? 'UNKNOWN',
      envelope?.message ?? `Request failed (${res.status}).`,
      envelope?.details ?? {},
    );
  }

  return body as T;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  description?: string;
  reference_id: string;
}

export interface CreateTransferInput {
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  description?: string;
  reference_id: string;
}

export interface HistoryParams {
  page?: number;
  limit?: number;
  type?: TransactionType;
}

export const api = {
  createAccount: (name: string): Promise<Account> =>
    request('/accounts', { method: 'POST', body: JSON.stringify({ name }) }),

  getBalance: (accountId: string): Promise<Balance> =>
    request(`/accounts/${accountId}/balance`),

  createTransaction: (accountId: string, input: CreateTransactionInput): Promise<Transaction> =>
    request(`/accounts/${accountId}/transactions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getTransactions: (accountId: string, params: HistoryParams = {}): Promise<TransactionPage> => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.type) q.set('type', params.type);
    const qs = q.toString();
    return request(`/accounts/${accountId}/transactions${qs ? `?${qs}` : ''}`);
  },

  createTransfer: (input: CreateTransferInput): Promise<Transfer> =>
    request('/transfers', { method: 'POST', body: JSON.stringify(input) }),
};
