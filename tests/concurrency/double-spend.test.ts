import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertLedgerInvariant,
  createAccount,
  ledgerSum,
  postTransaction,
  prisma,
  resetDb,
  startTestServer,
  storedBalance,
  type TestServer,
} from '../helpers/server.js';

describe('concurrency: no double spend', () => {
  let server: TestServer;
  const baseUrl = (): string => server.baseUrl;

  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });
  beforeEach(resetDb);

  it('100 debits of 200 against a balance of 10,000 settle to exactly 50 wins and balance 0', async () => {
    const id = await createAccount(baseUrl());
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 10_000, reference_id: 'seed' });

    // Fire all 100 at once. Only 50 can be covered (50 * 200 = 10,000).
    const attempts = Array.from({ length: 100 }, (_, i) =>
      postTransaction(baseUrl(), id, { type: 'debit', amount: 200, reference_id: `d-${i}` }),
    );
    const results = await Promise.all(attempts);

    const accepted = results.filter((r) => r.status === 201).length;
    const rejected = results.filter(
      (r) => r.status === 409 && (r.body as { error: { code: string } }).error.code === 'INSUFFICIENT_BALANCE',
    ).length;

    expect(accepted).toBe(50);
    expect(rejected).toBe(50);

    const balance = await storedBalance(id);
    expect(balance).toBe(0n);
    expect(balance >= 0n).toBe(true);
    expect(balance).toBe(await ledgerSum(id));
    expect(await prisma.transaction.count({ where: { accountId: id, type: 'debit' } })).toBe(50);

    await assertLedgerInvariant();
  });
});
