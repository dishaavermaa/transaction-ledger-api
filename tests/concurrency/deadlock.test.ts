import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  assertLedgerInvariant,
  createAccount,
  postTransaction,
  prisma,
  resetDb,
  startTestServer,
  storedBalance,
  type TestServer,
} from '../helpers/server.js';

describe('concurrency: transfers do not deadlock', () => {
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

  it('50 A->B and 50 B->A transfers all finish and conserve money', async () => {
    const a = await createAccount(baseUrl(), 'A');
    const b = await createAccount(baseUrl(), 'B');
    await postTransaction(baseUrl(), a, { type: 'credit', amount: 10_000, reference_id: 'seed-a' });
    await postTransaction(baseUrl(), b, { type: 'credit', amount: 10_000, reference_id: 'seed-b' });

    const transfer = (from: string, to: string, ref: string) =>
      api(baseUrl(), 'POST', '/transfers', {
        source_account_id: from,
        destination_account_id: to,
        amount: 10,
        reference_id: ref,
      });

    // Opposite directions at the same time. Because every transfer locks the two
    // rows in the same (id) order, there is no lock cycle and nothing deadlocks.
    const ops = [];
    for (let i = 0; i < 50; i++) {
      ops.push(transfer(a, b, `a2b-${i}`));
      ops.push(transfer(b, a, `b2a-${i}`));
    }
    const results = await Promise.all(ops);

    // All succeed, and none failed with a deadlock (which would surface as 500).
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(results.some((r) => r.status >= 500)).toBe(false);

    const balanceA = await storedBalance(a);
    const balanceB = await storedBalance(b);
    // Equal, offsetting transfers leave both where they started; total conserved.
    expect(balanceA).toBe(10_000n);
    expect(balanceB).toBe(10_000n);
    expect(balanceA + balanceB).toBe(20_000n);

    await assertLedgerInvariant();
  });
});
