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

const balanceOf = async (baseUrl: string, id: string): Promise<number> => {
  const res = await api<{ balance: number }>(baseUrl, 'GET', `/accounts/${id}/balance`);
  return res.body.balance;
};

describe('transactions', () => {
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

  it('a credit increases the balance', async () => {
    const id = await createAccount(baseUrl());
    const res = await postTransaction(baseUrl(), id, {
      type: 'credit',
      amount: 5000,
      reference_id: 'c1',
    });
    expect(res.status).toBe(201);
    expect(await balanceOf(baseUrl(), id)).toBe(5000);
  });

  it('a debit decreases the balance', async () => {
    const id = await createAccount(baseUrl());
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 5000, reference_id: 'c1' });
    await postTransaction(baseUrl(), id, { type: 'debit', amount: 2000, reference_id: 'd1' });
    expect(await balanceOf(baseUrl(), id)).toBe(3000);
  });

  it('rejects an overdrawing debit and changes nothing', async () => {
    const id = await createAccount(baseUrl());
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 100, reference_id: 'c1' });

    const res = await postTransaction(baseUrl(), id, { type: 'debit', amount: 150, reference_id: 'd1' });
    expect(res.status).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe('INSUFFICIENT_BALANCE');

    expect(await balanceOf(baseUrl(), id)).toBe(100);
    expect(await prisma.transaction.count({ where: { accountId: id } })).toBe(1);
  });

  it('rejects a duplicate reference_id on the same account without changing the balance', async () => {
    const id = await createAccount(baseUrl());
    const first = await postTransaction(baseUrl(), id, { type: 'credit', amount: 100, reference_id: 'dup' });
    expect(first.status).toBe(201);

    const second = await postTransaction(baseUrl(), id, { type: 'credit', amount: 500, reference_id: 'dup' });
    expect(second.status).toBe(409);
    expect((second.body as { error: { code: string } }).error.code).toBe('DUPLICATE_REFERENCE');

    expect(await balanceOf(baseUrl(), id)).toBe(100);
    expect(await prisma.transaction.count({ where: { accountId: id } })).toBe(1);
  });

  it('allows the same reference_id on different accounts', async () => {
    const a = await createAccount(baseUrl(), 'A');
    const b = await createAccount(baseUrl(), 'B');
    const ra = await postTransaction(baseUrl(), a, { type: 'credit', amount: 10, reference_id: 'shared' });
    const rb = await postTransaction(baseUrl(), b, { type: 'credit', amount: 20, reference_id: 'shared' });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
  });

  it('returns 404 when posting to an unknown account', async () => {
    const res = await postTransaction(baseUrl(), '11111111-1111-1111-1111-111111111111', {
      type: 'credit',
      amount: 10,
      reference_id: 'r',
    });
    expect(res.status).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('does not expose routes to update or delete a transaction', async () => {
    const id = await createAccount(baseUrl());
    const created = await postTransaction(baseUrl(), id, { type: 'credit', amount: 10, reference_id: 'r' });
    const txId = (created.body as { id: string }).id;

    const del = await api(baseUrl(), 'DELETE', `/accounts/${id}/transactions/${txId}`);
    const put = await api(baseUrl(), 'PUT', `/accounts/${id}/transactions/${txId}`);
    const patch = await api(baseUrl(), 'PATCH', `/accounts/${id}/transactions/${txId}`);
    expect(del.status).toBe(404);
    expect(put.status).toBe(404);
    expect(patch.status).toBe(404);
  });
});
