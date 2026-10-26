import { Prisma, type PrismaClient, type Transaction, type Transfer } from '@prisma/client';
import {
  accountNotFound,
  duplicateReference,
  duplicateTransfer,
  insufficientBalance,
  sameAccountTransfer,
} from '../../shared/errors/app-error.js';
import type { CreateTransferInput } from './transfers.schemas.js';

interface LockedAccount {
  id: string;
  balance: bigint;
}

export interface TransferResult {
  transfer: Transfer;
  debit: Transaction;
  credit: Transaction;
}

function isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class TransfersService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Moves money between two accounts as a single atomic unit. Either both ledger
   * entries and both balance updates persist, or none do.
   *
   * Deadlock resistance: both account rows are locked in ascending id order, so
   * opposite-direction transfers between the same pair always acquire locks in
   * the same global order and cannot deadlock each other.
   *
   * Idempotency: transfers.reference_id is globally unique. A retried transfer
   * fails the transfer insert and is reported as a 409 without touching balances.
   */
  async create(input: CreateTransferInput): Promise<TransferResult> {
    if (input.sourceAccountId === input.destinationAccountId) {
      throw sameAccountTransfer();
    }

    const amount = BigInt(input.amount);

    return this.prisma.$transaction(async (tx) => {
      // Lock both rows in a stable, deadlock-safe order.
      const locked = await tx.$queryRaw<LockedAccount[]>`
        SELECT id, balance
        FROM accounts
        WHERE id IN (${input.sourceAccountId}::uuid, ${input.destinationAccountId}::uuid)
        ORDER BY id
        FOR UPDATE
      `;

      const byId = new Map(locked.map((row) => [row.id, row]));
      const source = byId.get(input.sourceAccountId);
      const destination = byId.get(input.destinationAccountId);
      if (!source) throw accountNotFound(input.sourceAccountId);
      if (!destination) throw accountNotFound(input.destinationAccountId);

      if (source.balance < amount) {
        throw insufficientBalance(input.sourceAccountId, Number(source.balance), input.amount);
      }

      let transfer: Transfer;
      try {
        transfer = await tx.transfer.create({
          data: {
            sourceAccountId: input.sourceAccountId,
            destinationAccountId: input.destinationAccountId,
            amount,
            description: input.description ?? null,
            referenceId: input.referenceId,
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicateTransfer(input.referenceId);
        throw error;
      }

      // Two ledger entries share the transfer's reference_id (allowed because
      // they belong to different accounts) and point back via transfer_id.
      let debit: Transaction;
      let credit: Transaction;
      try {
        debit = await tx.transaction.create({
          data: {
            accountId: input.sourceAccountId,
            type: 'debit',
            amount,
            description: input.description ?? null,
            referenceId: input.referenceId,
            transferId: transfer.id,
          },
        });
        credit = await tx.transaction.create({
          data: {
            accountId: input.destinationAccountId,
            type: 'credit',
            amount,
            description: input.description ?? null,
            referenceId: input.referenceId,
            transferId: transfer.id,
          },
        });
      } catch (error) {
        // The reference_id already exists as a plain transaction on one of the
        // accounts. Roll back and report the per-account conflict.
        if (isUniqueViolation(error))
          throw duplicateReference(input.sourceAccountId, input.referenceId);
        throw error;
      }

      await tx.account.update({
        where: { id: input.sourceAccountId },
        data: { balance: source.balance - amount },
      });
      await tx.account.update({
        where: { id: input.destinationAccountId },
        data: { balance: destination.balance + amount },
      });

      return { transfer, debit, credit };
    });
  }
}
