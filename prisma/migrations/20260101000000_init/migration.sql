-- Enum for transaction direction.
CREATE TYPE "TransactionType" AS ENUM ('credit', 'debit');

-- Accounts.
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- Transfers. One row per transfer; reference_id is the idempotency key.
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "source_account_id" UUID NOT NULL,
    "destination_account_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT,
    "reference_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- Transactions (the ledger). transfer_id links the two legs of a transfer.
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" TEXT,
    "reference_id" TEXT NOT NULL,
    "transfer_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- Data-integrity CHECK constraints.
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_name_not_blank" CHECK (length(btrim("name")) > 0);
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_balance_non_negative" CHECK ("balance" >= 0);
ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "transfers"
    ADD CONSTRAINT "transfers_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "transfers"
    ADD CONSTRAINT "transfers_distinct_accounts" CHECK ("source_account_id" <> "destination_account_id");

-- reference_id is unique within an account; the same reference_id may be reused
-- across different accounts.
CREATE UNIQUE INDEX "transactions_account_id_reference_id_key"
    ON "transactions" ("account_id", "reference_id");

-- A transfer reference_id is globally unique, which makes retries idempotent.
CREATE UNIQUE INDEX "transfers_reference_id_key"
    ON "transfers" ("reference_id");

-- Supports newest-first history pagination with a deterministic id tiebreak.
CREATE INDEX "transactions_account_id_created_at_id_idx"
    ON "transactions" ("account_id", "created_at" DESC, "id" DESC);

-- Foreign keys. RESTRICT on delete keeps the ledger append-only and intact.
ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_transfer_id_fkey"
    FOREIGN KEY ("transfer_id") REFERENCES "transfers" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfers"
    ADD CONSTRAINT "transfers_source_account_id_fkey"
    FOREIGN KEY ("source_account_id") REFERENCES "accounts" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transfers"
    ADD CONSTRAINT "transfers_destination_account_id_fkey"
    FOREIGN KEY ("destination_account_id") REFERENCES "accounts" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
