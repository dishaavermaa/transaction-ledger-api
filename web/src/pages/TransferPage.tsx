import { useEffect, useMemo, useState } from 'react';
import { MoneyError, rupeesToMinor } from '../lib/money';
import { loadAccounts, type StoredAccount } from '../lib/storage';
import { useCreateTransfer } from '../hooks/queries';
import { EmptyState, ErrorBanner, Money } from '../components/ui';

function newReference(): string {
  return crypto.randomUUID();
}

export function TransferPage() {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState(newReference);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const list = loadAccounts();
    setAccounts(list);
    if (list[0]) setSource(list[0].id);
    if (list[1]) setDestination(list[1].id);
  }, []);

  const mutation = useCreateTransfer();

  const sameAccount = source !== '' && source === destination;
  const canSubmit = useMemo(
    () => source !== '' && destination !== '' && !sameAccount && amount.trim() !== '' && !mutation.isPending,
    [source, destination, sameAccount, amount, mutation.isPending],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (sameAccount) {
      setFormError('Source and destination must be different accounts.');
      return;
    }

    let minor: number;
    try {
      minor = rupeesToMinor(amount);
    } catch (err) {
      setFormError(err instanceof MoneyError ? err.message : 'Invalid amount.');
      return;
    }
    if (minor <= 0) {
      setFormError('Amount must be greater than zero.');
      return;
    }

    mutation.mutate(
      {
        source_account_id: source,
        destination_account_id: destination,
        amount: minor,
        description: description.trim() || undefined,
        reference_id: reference.trim(),
      },
      {
        onSuccess: () => {
          setAmount('');
          setDescription('');
          setReference(newReference());
        },
      },
    );
  };

  if (accounts.length < 2) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-cocoa-800">Transfer</h1>
        <EmptyState>
          You need at least two accounts on this device to make a transfer. Create them on the
          Accounts page first.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h1 className="mb-4 text-lg font-bold text-cocoa-800">Transfer between accounts</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="source" className="label">
                From
              </label>
              <select
                id="source"
                className="input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={mutation.isPending}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="destination" className="label">
                To
              </label>
              <select
                id="destination"
                className="input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                disabled={mutation.isPending}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sameAccount && (
            <p className="text-xs text-red-700">Choose two different accounts.</p>
          )}

          <div>
            <label htmlFor="t-amount" className="label">
              Amount (₹)
            </label>
            <input
              id="t-amount"
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div>
            <label htmlFor="t-description" className="label">
              Description (optional)
            </label>
            <input
              id="t-description"
              className="input"
              placeholder="e.g. Rent contribution"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div>
            <label htmlFor="t-reference" className="label">
              Reference ID
            </label>
            <div className="flex gap-2">
              <input
                id="t-reference"
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
              >
                New
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={!canSubmit}>
              {mutation.isPending ? 'Transferring…' : 'Send transfer'}
            </button>
            {formError && <p className="text-sm text-red-700">{formError}</p>}
            {mutation.isError && <ErrorBanner error={mutation.error} />}
          </div>
        </form>
      </section>

      {mutation.isSuccess && mutation.data && (
        <section className="card border-sky-200 bg-sky-50 p-5" role="status">
          <h2 className="mb-1 font-bold text-cocoa-800">Transfer complete</h2>
          <p className="text-sm text-cocoa-600">
            Moved <Money minor={mutation.data.amount} tone="plain" /> · reference{' '}
            <span className="font-mono text-xs">{mutation.data.reference_id}</span>
          </p>
        </section>
      )}
    </div>
  );
}
