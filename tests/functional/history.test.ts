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

interface HistoryBody {
  data: Array<{ id: string; type: string; reference_id: string }>;
  pagination: {
    current_page: number;
    page_size: number;
    total_records: number;
    total_pages: number;
  };
}

describe('transaction history', () => {
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

  it('returns transactions newest-first', async () => {
    const id = await createAccount(baseUrl());
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 1, reference_id: 'r1' });
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 2, reference_id: 'r2' });
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 3, reference_id: 'r3' });

    const res = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions`);
    expect(res.body.data.map((t) => t.reference_id)).toEqual(['r3', 'r2', 'r1']);
  });

  it('filters by type and returns both types by default', async () => {
    const id = await createAccount(baseUrl());
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 100, reference_id: 'c1' });
    await postTransaction(baseUrl(), id, { type: 'debit', amount: 40, reference_id: 'd1' });

    const all = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions`);
    expect(all.body.data).toHaveLength(2);

    const credits = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions?type=credit`);
    expect(credits.body.data).toHaveLength(1);
    expect(credits.body.data[0]?.type).toBe('credit');
  });

  it('orders deterministically by id when created_at ties', async () => {
    const id = await createAccount(baseUrl());
    const sharedTime = new Date('2026-01-01T00:00:00.000Z');
    await prisma.transaction.createMany({
      data: [
        { accountId: id, type: 'credit', amount: 1n, referenceId: 'a', createdAt: sharedTime },
        { accountId: id, type: 'credit', amount: 1n, referenceId: 'b', createdAt: sharedTime },
        { accountId: id, type: 'credit', amount: 1n, referenceId: 'c', createdAt: sharedTime },
      ],
    });

    const run1 = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions`);
    const run2 = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions`);
    const ids1 = run1.body.data.map((t) => t.id);
    const ids2 = run2.body.data.map((t) => t.id);
    expect(ids1).toEqual(ids2);
    expect(ids1).toEqual([...ids1].sort().reverse());
  });

  it('paginates with metadata', async () => {
    const id = await createAccount(baseUrl());
    for (let i = 0; i < 25; i++) {
      await postTransaction(baseUrl(), id, { type: 'credit', amount: 1, reference_id: `r${i}` });
    }
    const page1 = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions?page=1&limit=10`);
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.pagination).toEqual({
      current_page: 1,
      page_size: 10,
      total_records: 25,
      total_pages: 3,
    });

    const page3 = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions?page=3&limit=10`);
    expect(page3.body.data).toHaveLength(5);
  });

  it.each([
    ['page=0', 'page=0&limit=10'],
    ['limit=0', 'page=1&limit=0'],
    ['limit over max', 'page=1&limit=100000'],
    ['non-numeric page', 'page=abc&limit=10'],
  ])('rejects invalid pagination (%s) with 422', async (_label, qs) => {
    const id = await createAccount(baseUrl());
    const res = await api(baseUrl(), 'GET', `/accounts/${id}/transactions?${qs}`);
    expect(res.status).toBe(422);
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 and an empty array when nothing matches', async () => {
    const id = await createAccount(baseUrl());
    const res = await api<HistoryBody>(baseUrl(), 'GET', `/accounts/${id}/transactions?type=debit`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total_records).toBe(0);
  });

  it('returns 404 for history of an unknown account', async () => {
    const res = await api(baseUrl(), 'GET', '/accounts/11111111-1111-1111-1111-111111111111/transactions');
    expect(res.status).toBe(404);
  });
});
