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

describe('concurrency: mixed credits and debits', () => {
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

  it('final balance equals the arithmetic and the ledger sum', async () => {
    const id = await createAccount(baseUrl());
    // Seed high enough that no debit can overdraw regardless of interleaving
    // (50 debits of 100 = 5,000 < 10,000), so all 100 operations succeed and
    // the result is deterministic.
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 10_000, reference_id: 'seed' });

    const ops = [
      ...Array.from({ length: 50 }, (_, i) =>
        postTransaction(baseUrl(), id, { type: 'credit', amount: 100, reference_id: `c-${i}` }),
      ),
      ...Array.from({ length: 50 }, (_, i) =>
        postTransaction(baseUrl(), id, { type: 'debit', amount: 100, reference_id: `d-${i}` }),
      ),
    ];
    const results = await Promise.all(ops);
    expect(results.every((r) => r.status === 201)).toBe(true);

    // 10,000 + 50*100 - 50*100 = 10,000.
    const balance = await storedBalance(id);
    expect(balance).toBe(10_000n);
    expect(balance).toBe(await ledgerSum(id));

    await assertLedgerInvariant();
  });
});
