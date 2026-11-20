/**
 * The API intentionally has no "list all accounts" endpoint, so this browser
 * remembers the accounts it has created. This is a client-side convenience only
 * — the server stays the source of truth for balances and history.
 */
import type { Account } from './api';

const KEY = 'ledger:accounts';

export interface StoredAccount {
  id: string;
  name: string;
  created_at: string;
}

export function loadAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is StoredAccount =>
        typeof a?.id === 'string' && typeof a?.name === 'string' && typeof a?.created_at === 'string',
    );
  } catch {
    return [];
  }
}

export function rememberAccount(account: Account): StoredAccount[] {
  const next = loadAccounts().filter((a) => a.id !== account.id);
  next.unshift({ id: account.id, name: account.name, created_at: account.created_at });
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage disabled (private mode / blocked). The list simply won't persist.
  }
  return next;
}

export function findAccount(id: string): StoredAccount | undefined {
  return loadAccounts().find((a) => a.id === id);
}
