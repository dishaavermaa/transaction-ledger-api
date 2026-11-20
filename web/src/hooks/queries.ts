import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type Account,
  type CreateTransactionInput,
  type CreateTransferInput,
  type HistoryParams,
} from '../lib/api';
import { rememberAccount } from '../lib/storage';

export const keys = {
  balance: (id: string) => ['balance', id] as const,
  transactions: (id: string, params: HistoryParams) => ['transactions', id, params] as const,
};

export function useBalance(accountId: string) {
  return useQuery({
    queryKey: keys.balance(accountId),
    queryFn: () => api.getBalance(accountId),
  });
}

export function useTransactions(accountId: string, params: HistoryParams) {
  return useQuery({
    queryKey: keys.transactions(accountId, params),
    queryFn: () => api.getTransactions(accountId, params),
    placeholderData: (prev) => prev, // keep the page visible while fetching the next one
  });
}

export function useCreateAccount(onCreated?: (account: Account) => void) {
  return useMutation({
    mutationFn: (name: string) => api.createAccount(name),
    onSuccess: (account) => {
      rememberAccount(account);
      onCreated?.(account);
    },
  });
}

export function useCreateTransaction(accountId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => api.createTransaction(accountId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.balance(accountId) });
      void qc.invalidateQueries({ queryKey: ['transactions', accountId] });
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransferInput) => api.createTransfer(input),
    onSuccess: (transfer) => {
      for (const id of [transfer.source_account_id, transfer.destination_account_id]) {
        void qc.invalidateQueries({ queryKey: keys.balance(id) });
        void qc.invalidateQueries({ queryKey: ['transactions', id] });
      }
    },
  });
}
