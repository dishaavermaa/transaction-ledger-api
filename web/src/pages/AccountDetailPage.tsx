import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MoneyError, rupeesToMinor } from '../lib/money';
import { findAccount } from '../lib/storage';
import { useBalance, useCreateTransaction, useTransactions } from '../hooks/queries';
import type { HistoryParams, TransactionType } from '../lib/api';
import { ErrorBanner, EmptyState, Money, Spinner } from '../components/ui';

const PAGE_SIZE = 10;

function newReference(): string {
  return crypto.randomUUID();
}

export function AccountDetailPage() {
  const { accountId = '' } = useParams();
  const stored = findAccount(accountId);

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'' | TransactionType>('');

  const params: HistoryParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, ...(filter ? { type: filter } : {}) }),
    [page, filter],
  );

  const balance = useBalance(accountId);
  const history = useTransactions(accountId, params);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm font-semibold text-sky-600 hover:underline">
          ← All accounts
        </Link>
      </div>

      <section className="card p-5">
        <div className="text-sm text-cocoa-500">{stored?.name ?? 'Account'}</div>
        <div className="font-mono text-xs text-cocoa-500">{accountId}</div>
        <div className="mt-3">
          {balance.isLoading ? (
            <Spinner label="Loading balance…" />
          ) : balance.isError ? (
            <ErrorBanner error={balance.error} />
          ) : (
            <div className="text-3xl font-bold text-cocoa-800">
              <Money minor={balance.data!.balance} tone="plain" />
            </div>
          )}
        </div>
      </section>

      <TransactionForm accountId={accountId} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa-500">History</h2>
          <div className="flex gap-1">
            {(['', 'credit', 'debit'] as const).map((t) => (
              <button
                key={t || 'all'}
                onClick={() => {
                  setFilter(t);
                  setPage(1);
                }}
                className={`chip border ${
                  filter === t
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-cream-300 bg-cream-50 text-cocoa-600'
                }`}
              >
                {t === '' ? 'All' : t}
              </button>
            ))}
          </div>
        </div>

        {history.isLoading ? (
          <Spinner label="Loading transactions…" />
        ) : history.isError ? (
          <ErrorBanner error={history.error} />
        ) : history.data!.data.length === 0 ? (
          <EmptyState>No transactions{filter ? ` of type "${filter}"` : ''} yet.</EmptyState>
        ) : (
          <>
            <ul className="space-y-2">
              {history.data!.data.map((tx) => (
                <li key={tx.id} className="card flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`chip ${
                          tx.type === 'credit'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-cream-200 text-cocoa-700'
                        }`}
                      >
                        {tx.type}
                      </span>
                      <span className="truncate text-sm text-cocoa-700">
                        {tx.description || '—'}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-cocoa-500">
                      ref {tx.reference_id}
                      {tx.transfer_id ? ' · transfer' : ''} ·{' '}
                      {new Date(tx.created_at).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <Money minor={tx.amount} tone={tx.type} />
                </li>
              ))}
            </ul>

            <Pager
              page={history.data!.pagination.current_page}
              totalPages={history.data!.pagination.total_pages}
              fetching={history.isFetching}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function TransactionForm({ accountId }: { accountId: string }) {
  const [type, setType] = useState<TransactionType>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState(newReference);
  const [amountError, setAmountError] = useState<string | null>(null);

  const mutation = useCreateTransaction(accountId);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAmountError(null);

    let minor: number;
    try {
      minor = rupeesToMinor(amount);
    } catch (err) {
      setAmountError(err instanceof MoneyError ? err.message : 'Invalid amount.');
      return;
    }
    if (minor <= 0) {
      setAmountError('Amount must be greater than zero.');
      return;
    }
    if (!reference.trim() || mutation.isPending) return;

    mutation.mutate(
      {
        type,
        amount: minor,
        description: description.trim() || undefined,
        reference_id: reference.trim(),
      },
      {
        onSuccess: () => {
          setAmount('');
          setDescription('');
          setReference(newReference()); // fresh idempotency key for the next entry
        },
      },
    );
  };

  return (
    <section className="card p-5">
      <h2 className="mb-4 text-base font-bold text-cocoa-800">Add transaction</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="type" className="label">
              Type
            </label>
            <select
              id="type"
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              disabled={mutation.isPending}
            >
              <option value="credit">Credit (money in)</option>
              <option value="debit">Debit (money out)</option>
            </select>
          </div>
          <div>
            <label htmlFor="amount" className="label">
              Amount (₹)
            </label>
            <input
              id="amount"
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={mutation.isPending}
              aria-invalid={amountError ? true : undefined}
            />
            {amountError && <p className="mt-1 text-xs text-red-700">{amountError}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description (optional)
          </label>
          <input
            id="description"
            className="input"
            placeholder="e.g. Opening deposit"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={mutation.isPending}
          />
        </div>

        <div>
          <label htmlFor="reference" className="label">
            Reference ID (idempotency key)
          </label>
          <div className="flex gap-2">
            <input
              id="reference"
              className="input font-mono text-xs"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={mutation.isPending}
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setReference(newReference())}
              disabled={mutation.isPending}
              title="Generate a new reference"
            >
              New
            </button>
          </div>
          <p className="mt-1 text-xs text-cocoa-500">
            Sending the same reference again is rejected, so a retry can never double-post.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Posting…' : 'Post transaction'}
          </button>
          {mutation.isError && <ErrorBanner error={mutation.error} />}
        </div>
      </form>
    </section>
  );
}

function Pager({
  page,
  totalPages,
  fetching,
  onChange,
}: {
  page: number;
  totalPages: number;
  fetching: boolean;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-1 text-sm">
      <button
        className="btn-ghost"
        disabled={page <= 1 || fetching}
        onClick={() => onChange(page - 1)}
      >
        ← Prev
      </button>
      <span className="text-cocoa-500">
        Page {page} of {totalPages}
      </span>
      <button
        className="btn-ghost"
        disabled={page >= totalPages || fetching}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
