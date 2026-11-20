import { formatMinor } from '../lib/money';
import { ApiError } from '../lib/api';

/** Integer paise rendered as an INR amount. Debits show in cocoa, credits in sky. */
export function Money({ minor, tone }: { minor: number; tone?: 'credit' | 'debit' | 'plain' }) {
  const color =
    tone === 'credit' ? 'text-sky-600' : tone === 'debit' ? 'text-cocoa-600' : 'text-cocoa-800';
  return (
    <span className={`tabular-nums font-semibold ${color}`}>
      {tone === 'debit' ? '-' : tone === 'credit' ? '+' : ''}
      {formatMinor(minor)}
    </span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-cocoa-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream-300 border-t-sky-500" />
      {label}
    </div>
  );
}

/** Turns any thrown error (ApiError or otherwise) into a readable banner. */
export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const { code, message } = describe(error);
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      <span className="font-semibold">{code}:</span> {message}
    </div>
  );
}

function describe(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: 'ERROR', message: error.message };
  return { code: 'ERROR', message: 'Something went wrong.' };
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50 px-4 py-10 text-center text-sm text-cocoa-500">
      {children}
    </div>
  );
}
