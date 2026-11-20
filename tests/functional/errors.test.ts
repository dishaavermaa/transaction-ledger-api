import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createAccount,
  postTransaction,
  prisma,
  rawPost,
  resetDb,
  startTestServer,
  type ApiResponse,
  type TestServer,
} from '../helpers/server.js';

/** Every error must come back as { error: { code, message, details } }. */
function expectErrorShape(res: ApiResponse, status: number, code: string): void {
  expect(res.status).toBe(status);
  const body = res.body as { error?: { code?: unknown; message?: unknown; details?: unknown } };
  expect(body.error).toBeDefined();
  expect(body.error?.code).toBe(code);
  expect(typeof body.error?.message).toBe('string');
  expect(body.error?.details).toBeDefined();
}

describe('error handling', () => {
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

  it('malformed JSON -> 400 MALFORMED_JSON', async () => {
    const res = await rawPost(baseUrl(), '/accounts', '{ not valid json');
    expectErrorShape(res, 400, 'MALFORMED_JSON');
  });

  it('unknown account -> 404 ACCOUNT_NOT_FOUND', async () => {
    const res = await api(baseUrl(), 'GET', '/accounts/11111111-1111-1111-1111-111111111111/balance');
    expectErrorShape(res, 404, 'ACCOUNT_NOT_FOUND');
  });

  it('insufficient funds -> 409 INSUFFICIENT_BALANCE', async () => {
    const id = await createAccount(baseUrl());
    const res = await postTransaction(baseUrl(), id, { type: 'debit', amount: 10, reference_id: 'd' });
    expectErrorShape(res, 409, 'INSUFFICIENT_BALANCE');
  });

  it('duplicate reference -> 409 DUPLICATE_REFERENCE', async () => {
    const id = await createAccount(baseUrl());
    await postTransaction(baseUrl(), id, { type: 'credit', amount: 10, reference_id: 'dup' });
    const res = await postTransaction(baseUrl(), id, { type: 'credit', amount: 10, reference_id: 'dup' });
    expectErrorShape(res, 409, 'DUPLICATE_REFERENCE');
  });

  it('missing required field -> 422 VALIDATION_ERROR', async () => {
    const res = await api(baseUrl(), 'POST', '/accounts', {});
    expectErrorShape(res, 422, 'VALIDATION_ERROR');
  });

  it('blank name -> 422 VALIDATION_ERROR', async () => {
    const res = await api(baseUrl(), 'POST', '/accounts', { name: '   ' });
    expectErrorShape(res, 422, 'VALIDATION_ERROR');
  });

  it('invalid transaction type -> 422 VALIDATION_ERROR', async () => {
    const id = await createAccount(baseUrl());
    const res = await postTransaction(baseUrl(), id, { type: 'withdraw', amount: 10, reference_id: 'r' });
    expectErrorShape(res, 422, 'VALIDATION_ERROR');
  });

  it.each([
    ['zero amount', 0],
    ['negative amount', -5],
    ['non-integer amount', 10.5],
  ])('invalid amount (%s) -> 422 VALIDATION_ERROR', async (_label, amount) => {
    const id = await createAccount(baseUrl());
    const res = await postTransaction(baseUrl(), id, { type: 'credit', amount, reference_id: 'r' });
    expectErrorShape(res, 422, 'VALIDATION_ERROR');
  });

  it('transfer to the same account -> 422 SAME_ACCOUNT_TRANSFER', async () => {
    const id = await createAccount(baseUrl());
    const res = await api(baseUrl(), 'POST', '/transfers', {
      source_account_id: id,
      destination_account_id: id,
      amount: 10,
      reference_id: 't',
    });
    expectErrorShape(res, 422, 'SAME_ACCOUNT_TRANSFER');
  });
});
