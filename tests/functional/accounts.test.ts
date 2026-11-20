import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createAccount,
  prisma,
  resetDb,
  startTestServer,
  type TestServer,
} from '../helpers/server.js';

describe('accounts', () => {
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

  it('creates an account that starts at balance 0 with a server-generated id and timestamp', async () => {
    const res = await api(baseUrl(), 'POST', '/accounts', { name: 'Aarav Sharma' });
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.name).toBe('Aarav Sharma');
    expect(body.balance).toBe(0);
    expect(typeof body.created_at).toBe('string');
    expect(Number.isNaN(Date.parse(body.created_at as string))).toBe(false);
  });

  it('strips a client-supplied id, balance, or created_at', async () => {
    const res = await api(baseUrl(), 'POST', '/accounts', {
      name: 'Hacker',
      id: 'injected',
      balance: 9999,
      created_at: '2000-01-01',
    });
    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.balance).toBe(0);
    expect(body.id).not.toBe('injected');
    expect(Date.parse(body.created_at as string)).toBeGreaterThan(Date.parse('2020-01-01'));
  });

  it('trims the account name', async () => {
    const res = await api(baseUrl(), 'POST', '/accounts', { name: '  Priya  ' });
    expect((res.body as { name: string }).name).toBe('Priya');
  });

  it('returns account_id and balance from the balance endpoint', async () => {
    const id = await createAccount(baseUrl(), 'Bal');
    const res = await api(baseUrl(), 'GET', `/accounts/${id}/balance`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ account_id: id, balance: 0 });
  });

  it('returns 404 for the balance of an unknown account', async () => {
    const res = await api(baseUrl(), 'GET', '/accounts/11111111-1111-1111-1111-111111111111/balance');
    expect(res.status).toBe(404);
    expect((res.body as { error: { code: string } }).error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});
