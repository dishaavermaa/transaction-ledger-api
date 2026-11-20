import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAccounts, type StoredAccount } from '../lib/storage';
import { useCreateAccount } from '../hooks/queries';
import { ErrorBanner, EmptyState } from '../components/ui';

export function AccountsPage() {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    setAccounts(loadAccounts());
  }, []);

  const create = useCreateAccount((account) => {
    setAccounts(loadAccounts());
    setName('');
    void account;
  });

  const trimmed = name.trim();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed);
  };

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h1 className="mb-1 text-lg font-bold text-cocoa-800">Accounts</h1>
        <p className="mb-4 text-sm text-cocoa-500">
          Create an account, then open it to add credits, debits, and view its history.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="name" className="label">
              Account holder name
            </label>
            <input
              id="name"
              className="input"
              placeholder="e.g. Aarav Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={create.isPending}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!trimmed || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create account'}
          </button>
        </form>
        {create.isError && (
          <div className="mt-3">
            <ErrorBanner error={create.error} />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa-500">
          On this device
        </h2>
        {accounts.length === 0 ? (
          <EmptyState>No accounts yet. Create one above to get started.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/accounts/${a.id}`}
                  className="card flex items-center justify-between p-4 transition-colors hover:border-sky-400"
                >
                  <div>
                    <div className="font-semibold text-cocoa-800">{a.name}</div>
                    <div className="font-mono text-xs text-cocoa-500">{a.id}</div>
                  </div>
                  <span className="text-sky-600" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
