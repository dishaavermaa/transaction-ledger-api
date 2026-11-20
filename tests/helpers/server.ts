import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/shared/database/prisma.js';

export { prisma };

export interface TestServer {
  app: FastifyInstance;
  baseUrl: string;
  close(): Promise<void>;
}

/**
 * Starts the real Fastify app on an ephemeral port and talks to it over real
 * HTTP (via fetch). Using a listening socket rather than in-process injection
 * means the concurrency tests exercise genuinely parallel requests.
 */
export async function startTestServer(): Promise<TestServer> {
  const app = await buildApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    app,
    baseUrl,
    close: () => app.close(),
  };
}

/** Clears all ledger data so each test starts from an empty database. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "transactions", "transfers", "accounts" RESTART IDENTITY CASCADE',
  );
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

/** Minimal typed fetch wrapper that always parses the JSON body. */
export async function api<T = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as T };
}

/** Sends a raw body (used to test malformed JSON). */
export async function rawPost(baseUrl: string, path: string, rawBody: string): Promise<ApiResponse> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

interface AccountResponse {
  id: string;
}

export async function createAccount(baseUrl: string, name = 'Test User'): Promise<string> {
  const res = await api<AccountResponse>(baseUrl, 'POST', '/accounts', { name });
  return res.body.id;
}

export async function postTransaction(
  baseUrl: string,
  accountId: string,
  payload: Record<string, unknown>,
): Promise<ApiResponse<Record<string, unknown>>> {
  return api(baseUrl, 'POST', `/accounts/${accountId}/transactions`, payload);
}

/** The signed sum of an account's ledger rows (credits add, debits subtract). */
export async function ledgerSum(accountId: string): Promise<bigint> {
  const rows = await prisma.transaction.findMany({ where: { accountId } });
  return rows.reduce((sum, tx) => (tx.type === 'credit' ? sum + tx.amount : sum - tx.amount), 0n);
}

export async function storedBalance(accountId: string): Promise<bigint> {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
  return account.balance;
}

/**
 * The core ledger invariant: for every account, the cached balance must equal
 * the signed sum of its transactions. Asserted after each concurrency test.
 */
export async function assertLedgerInvariant(): Promise<void> {
  const accounts = await prisma.account.findMany();
  for (const account of accounts) {
    const sum = await ledgerSum(account.id);
    if (account.balance !== sum) {
      throw new Error(
        `Ledger invariant broken for account ${account.id}: stored balance ${account.balance} != ledger sum ${sum}`,
      );
    }
  }
}
