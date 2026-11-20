import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountDetailPage } from '../pages/AccountDetailPage';
import { server } from './msw/server';
import { API, errorEnvelope } from './msw/handlers';

const ACCOUNT_ID = '11111111-1111-1111-1111-111111111111';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/accounts/${ACCOUNT_ID}`]}>
        <Routes>
          <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AccountDetailPage transaction form', () => {
  it('rejects an amount with more than two decimals before calling the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Amount (₹)'), '1.234');
    await user.click(screen.getByRole('button', { name: /post transaction/i }));

    expect(await screen.findByText(/up to 2 decimal places/i)).toBeInTheDocument();
  });

  it('renders the API error code when the backend rejects the transaction', async () => {
    server.use(
      http.post(`${API}/accounts/:id/transactions`, () =>
        HttpResponse.json(
          errorEnvelope('INSUFFICIENT_BALANCE', 'The account does not have enough balance.'),
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Amount (₹)'), '50');
    await user.click(screen.getByRole('button', { name: /post transaction/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('INSUFFICIENT_BALANCE');
    expect(alert).toHaveTextContent(/enough balance/i);
  });

  it('shows the live balance from the API', async () => {
    renderPage();
    // Default MSW balance handler returns 10,000 paise = ₹100.00.
    await waitFor(() => expect(screen.getByText(/100\.00/)).toBeInTheDocument());
  });
});
