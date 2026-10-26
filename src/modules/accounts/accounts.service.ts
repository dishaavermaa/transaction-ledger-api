import type { Account, PrismaClient } from '@prisma/client';
import { accountNotFound } from '../../shared/errors/app-error.js';

export class AccountsService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Creates an account with a zero balance and a system-generated id/timestamp. */
  async create(name: string): Promise<Account> {
    return this.prisma.account.create({ data: { name } });
  }

  /** Returns the account or throws a 404 AppError. */
  async getOrThrow(accountId: string): Promise<Account> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw accountNotFound(accountId);
    return account;
  }
}
