import { http, HttpResponse } from 'msw';

const API = 'http://localhost:3000';

function errorEnvelope(code: string, message: string, details: Record<string, unknown> = {}) {
  return { error: { code, message, details } };
}

/** Happy-path defaults. Individual tests override these with server.use(). */
export const handlers = [
  http.get(`${API}/accounts/:id/balance`, ({ params }) =>
    HttpResponse.json({ account_id: params.id, balance: 10_000 }),
  ),

  http.get(`${API}/accounts/:id/transactions`, () =>
    HttpResponse.json({
      data: [],
      pagination: { current_page: 1, page_size: 10, total_records: 0, total_pages: 0 },
    }),
  ),

  http.post(`${API}/accounts/:id/transactions`, async ({ params, request }) => {
    const body = (await request.json()) as { type: string; amount: number; reference_id: string };
    return HttpResponse.json(
      {
        id: 'tx-1',
        account_id: params.id,
        type: body.type,
        amount: body.amount,
        description: null,
        reference_id: body.reference_id,
        transfer_id: null,
        created_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  http.post(`${API}/transfers`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        id: 'tr-1',
        source_account_id: body.source_account_id,
        destination_account_id: body.destination_account_id,
        amount: body.amount,
        description: null,
        reference_id: body.reference_id,
        created_at: new Date().toISOString(),
        entries: [],
      },
      { status: 201 },
    );
  }),
];

export { API, errorEnvelope };
