import type { Account, Transaction, Transfer } from '@prisma/client';

/**
 * Money is stored as BigInt. API responses expose it as a JSON number in minor
 * units. Values are well within Number.MAX_SAFE_INTEGER for realistic ledgers;
 * see ASSUMPTIONS.md for the rationale and limits.
 */
function toNumber(value: bigint): number {
  return Number(value);
}

export function serializeAccount(account: Account) {
  return {
    id: account.id,
    name: account.name,
    balance: toNumber(account.balance),
    created_at: account.createdAt.toISOString(),
  };
}

export function serializeTransaction(tx: Transaction) {
  return {
    id: tx.id,
    account_id: tx.accountId,
    type: tx.type,
    amount: toNumber(tx.amount),
    description: tx.description,
    reference_id: tx.referenceId,
    transfer_id: tx.transferId,
    created_at: tx.createdAt.toISOString(),
  };
}

export function serializeTransfer(transfer: Transfer) {
  return {
    id: transfer.id,
    source_account_id: transfer.sourceAccountId,
    destination_account_id: transfer.destinationAccountId,
    amount: toNumber(transfer.amount),
    description: transfer.description,
    reference_id: transfer.referenceId,
    created_at: transfer.createdAt.toISOString(),
  };
}
