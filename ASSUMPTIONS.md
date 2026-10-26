# Assumptions and decisions

Where the assignment left something open, here's what I decided and why.

## Money

Everything monetary is an integer in minor units — `1050` is 10.50 — stored in `BIGINT`
columns and sent over the API as plain JSON integers. Balance arithmetic runs on `BigInt`
in the services, so floating point never gets near a balance.

Responses convert that `BigInt` to a JSON number. That's safe up to about 90 trillion (at
two decimals) before you'd lose precision, which is far more than this exercise needs. If I
were handling sums near that range I'd send money as strings instead, but doing that here
would just make every response awkward to read for no real gain.

I assumed a single currency, so there's no currency field.

## IDs, timestamps, and account creation

IDs are UUIDs. `created_at` is set by the database (`DEFAULT CURRENT_TIMESTAMP`), so it's
always UTC and the client can't set it.

Creating an account only reads `name`. If a client also sends `id`, `balance`, or
`created_at`, those fields are dropped rather than rejected — the Zod schema just strips
anything it doesn't know about, and the account always starts at balance 0. I went with
"ignore" over "reject" so a client that sends a few extra fields still succeeds, which felt
friendlier than a 422 for something harmless.

## Validation and status codes

Zod does all the request validation, inside each handler. The `schema` blocks on the routes
are only there to feed the Swagger docs — Fastify's own validation is turned off (a
no-op validator compiler) so there's a single place where validation errors come from and
they all look the same.

The status codes:

- `201` — created
- `200` — successful read
- `400` — the body isn't valid JSON (`MALFORMED_JSON`)
- `404` — account or route not found (`ACCOUNT_NOT_FOUND`)
- `409` — a conflict with current state: duplicate reference (`DUPLICATE_REFERENCE`),
  duplicate transfer (`DUPLICATE_TRANSFER`), or not enough balance (`INSUFFICIENT_BALANCE`)
- `422` — valid JSON that fails the rules (`VALIDATION_ERROR`), including a transfer whose
  source and destination are the same account (`SAME_ACCOUNT_TRANSFER`)
- `500` — something unexpected, with nothing internal leaked

Two of those are worth calling out. Insufficient balance is a `409`, not a `422` — the
request is fine, it just conflicts with the account's current state, and the assignment
lists it under conflicts. And a duplicate `reference_id` is a `409` too: the assignment asks
for "a clear conflict response" with no new transaction and no balance change, and a 409
with a stable code does that. I could have made it fully idempotent — store and replay the
original response — but that wasn't required and it adds moving parts, so I left it.

## Transactions

`description` is optional and stored as `NULL` when it's missing. `reference_id` is
required and trimmed. `amount` has to be a positive integer, so zero and negatives get a
422. There's no way to edit or delete a transaction through the API — those routes don't
exist, and an `ON DELETE RESTRICT` foreign key stops rows being removed by a cascade either.

## History and pagination

Defaults are `page=1`, `limit=20`, and the max `limit` is configurable (`MAX_PAGE_SIZE`,
default 100). Bad pagination — page or limit below 1, a limit over the max, something
non-numeric — comes back as a 422 rather than being quietly clamped, so the caller knows
what happened. Results are newest first by `created_at`, with `id` as a tiebreak so rows
sharing a timestamp still come out in a stable order; there's a composite index matching
that sort. An account that exists but has no matching rows returns `200` with an empty
array; one that doesn't exist returns `404`.

## Transfers

A transfer is one `transfers` row plus two ledger entries — a debit on the source and a
credit on the destination — both pointing back at it through `transfer_id`. The ledger is
still the source of truth for balances; the `transfers` row is really just the transfer's
identity and its idempotency key.

That key is `transfers.reference_id`, and it's globally unique, which is what makes a retry
safe: the second attempt fails the insert and returns `409 DUPLICATE_TRANSFER` without
moving anything. The two ledger entries reuse that same `reference_id`; since transaction
references are only unique within an account, the same value on the two different accounts
is fine. The one edge case: if that reference already exists as a plain transaction on one
of the accounts, the transfer can't use it and the whole thing rolls back.

Source and destination have to differ (422), both accounts have to exist (404), and the
source needs the balance (409).

## Concurrency

The database runs at its default `READ COMMITTED` isolation. The correctness under
concurrent requests doesn't come from a stricter isolation level or any in-process lock —
it comes from explicit row locks (`SELECT ... FOR UPDATE`). The README's concurrency
section walks through how that plays out for debits and for transfers.

## Out of scope

No authentication or authorization — deliberately, per the assignment, though it's the
first thing you'd put in front of this for real. No soft deletes, no closing an account, no
multiple currencies, and no rounding rules.
