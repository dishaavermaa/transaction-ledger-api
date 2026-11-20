import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createAccount,
  postTransaction,
  prisma,
  resetDb,
  startTestServer,
  type TestServer,
} from '../helpers/server.js';

const MISSING_ID = '11111111-1111-1111-1111-111111111111';

const balanceOf = async (baseUrl: string, id: string): Promise<number> => {
  const res = await api<{ balance: number }>(baseUrl, 'GET', `/accounts/${id}/balance`);
  return res.body.balance;
};

describe('transfers', () => {
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

  async function fundedPair(): Promise<{ a: string; b: string }> {
    const a = await createAccount(baseUrl(), 'A');
    const b = await createAccount(baseUrl(), 'B');
    await postTransaction(baseUrl(), a, { type: 'credit', amount: 100, reference_id: 'seed-a' });
    await postTransaction(baseUrl(), b, { type: 'credit', amount: 50, reference_id: 'seed-b' });
    return { a, b };
  }

  it('moves money and records two linked ledger entries', async () => {
    const { a, b } = await fundedPair();
    const res = await api<{ id: string; entries: unknown[] }>(baseUrl(), 'POST', '/transfers', {
      source_account_id: a,
      destination_account_id: b,
      amount: 30,
      reference_id: 't1',
    });
    expect(res.status).toBe(201);
    expect(res.body.entries).toHaveLength(2);

    expect(await balanceOf(baseUrl(), a)).toBe(70);
    expect(await balanceOf(baseUrl(), b)).toBe(80);

    const entries = await prisma.transaction.findMany({ where: { transferId: res.body.id } });
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((e) => e.type))).toEqual(new Set(['credit', 'debit']));
  });

  it('rolls back the whole transfer when the source has insufficient balance', async () => {
    const { a, b } = await fundedPair();
    const res = await api(baseUrl(), 'POST', '/transfers', {
      source_account_id: a,
      destination_account_id: b,
      amount: 1000,
      reference_id: 't1',
    });
    expect(res.status).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe('INSUFFICIENT_BALANCE');

    expect(await balanceOf(baseUrl(), a)).toBe(100);
    expect(await balanceOf(baseUrl(), b)).toBe(50);
    expect(await prisma.transfer.count()).toBe(0);
    expect(await prisma.transaction.count({ where: { transferId: { not: null } } })).toBe(0);
  });

  it('is idempotent on a duplicate reference_id and leaves balances unchanged', async () => {
    const { a, b } = await fundedPair();
    const payload = { source_account_id: a, destination_account_id: b, amount: 30, reference_id: 'dup' };
    const first = await api(baseUrl(), 'POST', '/transfers', payload);
    expect(first.status).toBe(201);

    const second = await api(baseUrl(), 'POST', '/transfers', payload);
    expect(second.status).toBe(409);
    expect((second.body as { error: { code: string } }).error.code).toBe('DUPLICATE_TRANSFER');

    expect(await balanceOf(baseUrl(), a)).toBe(70);
    expect(await balanceOf(baseUrl(), b)).toBe(80);
    expect(await prisma.transfer.count()).toBe(1);
  });

  it('rejects a transfer to the same account with 422', async () => {
    const a = await createAccount(baseUrl(), 'A');
    const res = await api(baseUrl(), 'POST', '/transfers', {
      source_account_id: a,
      destination_account_id: a,
      amount: 10,
      reference_id: 't1',
    });
    expect(res.status).toBe(422);
    expect((res.body as { error: { code: string } }).error.code).toBe('SAME_ACCOUNT_TRANSFER');
  });

  it.each([
    ['missing source', (b: string) => ({ source_account_id: MISSING_ID, destination_account_id: b })],
    ['missing destination', (b: string) => ({ source_account_id: b, destination_account_id: MISSING_ID })],
  ])('returns 404 for a %s', async (_label, build) => {
    const b = await createAccount(baseUrl(), 'B');
    await postTransaction(baseUrl(), b, { type: 'credit', amount: 100, reference_id: 'seed' });
    const res = await api(baseUrl(), 'POST', '/transfers', {
      ...build(b),
      amount: 10,
      reference_id: 't1',
    });
    expect(res.status).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});
