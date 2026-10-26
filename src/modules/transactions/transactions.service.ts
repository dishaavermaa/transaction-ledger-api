import { Prisma, type PrismaClient, type Transaction, type TransactionType } from '@prisma/client';
import {
  accountNotFound,
  duplicateReference,
  insufficientBalance,
} from '../../shared/errors/app-error.js';
import type { CreateTransactionInput } from './transactions.schemas.js';

interface LockedAccount {
  id: string;
  balance: bigint;
}

export interface HistoryQuery {
  page: number;
  limit: number;
  type?: TransactionType;
}

export interface HistoryResult {
  records: Transaction[];
  totalRecords: number;
}

export class TransactionsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates a transaction and updates the account balance as one atomic unit.
   *
   * Concurrency: the account row is locked with SELECT ... FOR UPDATE at the top
   * of the transaction. Concurrent writes to the same account serialize behind
   * that lock, so a balance check and the subsequent debit cannot interleave and
   * overspend. The composite UNIQUE (account_id, reference_id) constraint is the
   * final integrity boundary for duplicate references.
   */
  async create(accountId: string, input: CreateTransactionInput): Promise<Transaction> {
    const amount = BigInt(input.amount);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<LockedAccount[]>`
          SELECT id, balance FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE
        `;
        const account = locked[0];
        if (!account) throw accountNotFound(accountId);

        if (input.type === 'debit' && account.balance < amount) {
          throw insufficientBalance(accountId, Number(account.balance), input.amount);
        }

        const newBalance =
          input.type === 'credit' ? account.balance + amount : account.balance - amount;

        const created = await tx.transaction.create({
          data: {
            accountId,
            type: input.type,
            amount,
            description: input.description ?? null,
            referenceId: input.referenceId,
          },
        });

        await tx.account.update({ where: { id: accountId }, data: { balance: newBalance } });

        return created;
      });
    } catch (error) {
      // Backstop for a race the row lock cannot cover (e.g. two inserts that
      // never shared the same locked account row): the DB unique constraint.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw duplicateReference(accountId, input.referenceId);
      }
      throw error;
    }
  }

  /** Lists an account's transactions, newest first, with a deterministic id tiebreak. */
  async history(accountId: string, query: HistoryQuery): Promise<HistoryResult> {
    const where = {
      accountId,
      ...(query.type ? { type: query.type } : {}),
    };

    const [records, totalRecords] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { records, totalRecords };
  }
}
