import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
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

describe('concurrency: idempotency under parallel retries', () => {
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

  it('the same transaction reference_id sent 20x in parallel applies exactly once', async () => {
    const id = await createAccount(baseUrl());

    const attempts = Array.from({ length: 20 }, () =>
      postTransaction(baseUrl(), id, { type: 'credit', amount: 500, reference_id: 'once' }),
    );
    const results = await Promise.all(attempts);

    const accepted = results.filter((r) => r.status === 201).length;
    const conflicts = results.filter(
      (r) => r.status === 409 && (r.body as { error: { code: string } }).error.code === 'DUPLICATE_REFERENCE',
    ).length;

    expect(accepted).toBe(1);
    expect(conflicts).toBe(19);

    const balance = await storedBalance(id);
    expect(balance).toBe(500n);
    expect(balance).toBe(await ledgerSum(id));
    expect(await prisma.transaction.count({ where: { accountId: id } })).toBe(1);

    await assertLedgerInvariant();
  });

  it('the same transfer reference_id sent 20x in parallel moves money exactly once', async () => {
    const a = await createAccount(baseUrl(), 'A');
    const b = await createAccount(baseUrl(), 'B');
    await postTransaction(baseUrl(), a, { type: 'credit', amount: 10_000, reference_id: 'seed-a' });

    const attempts = Array.from({ length: 20 }, () =>
      api(baseUrl(), 'POST', '/transfers', {
        source_account_id: a,
        destination_account_id: b,
        amount: 300,
        reference_id: 'transfer-once',
      }),
    );
    const results = await Promise.all(attempts);

    const accepted = results.filter((r) => r.status === 201).length;
    const conflicts = results.filter(
      (r) => r.status === 409 && (r.body as { error: { code: string } }).error.code === 'DUPLICATE_TRANSFER',
    ).length;

    expect(accepted).toBe(1);
    expect(conflicts).toBe(19);

    expect(await storedBalance(a)).toBe(9_700n);
    expect(await storedBalance(b)).toBe(300n);
    expect(await prisma.transfer.count()).toBe(1);

    await assertLedgerInvariant();
  });
});
