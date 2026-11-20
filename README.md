# Transaction Ledger API

A small REST API for a transaction ledger: create accounts, post credit and debit
transactions, check balances, page through history, and move money between accounts.
Built with Fastify, Prisma, and Postgres.

The interesting part of this problem is keeping balances correct when requests overlap, so
that's where most of the design effort went — see [Concurrency](#concurrency) below.

Money is stored as integers in minor units, so `5000` means 50.00. No floating point ever
touches a balance. The reasoning and the other judgement calls are in
[ASSUMPTIONS.md](./ASSUMPTIONS.md).

There's also a small React web app in [`web/`](./web) for doing all of this in a browser,
and a test suite that exercises the behaviour and the concurrency guarantees against a real
database — both covered below.

## Endpoints

- `POST /accounts` — create an account; the balance always starts at 0
- `POST /accounts/:id/transactions` — post a credit or debit
- `GET /accounts/:id/balance` — current balance
- `GET /accounts/:id/transactions` — history, newest first, filter by `type`, paged with
  `page` and `limit`
- `POST /transfers` — move money between two accounts atomically

Swagger UI lives at `/docs` once the server is running.

## Running the API

You'll need Node 20+ and Docker.

```bash
npm install
docker compose up -d postgres      # Postgres, mapped to host port 5544
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

That brings the API up on http://localhost:3000. For a compiled run instead of watch mode,
use `npm run build && npm start`.

A quick check that it's alive:

```bash
curl -X POST http://localhost:3000/accounts \
  -H 'Content-Type: application/json' -d '{"name":"Aarav"}'

# take the id from that response, then:
curl -X POST http://localhost:3000/accounts/<id>/transactions \
  -H 'Content-Type: application/json' \
  -d '{"type":"credit","amount":5000,"reference_id":"deposit-1"}'

curl http://localhost:3000/accounts/<id>/balance
```

The `5544` port is deliberate: I kept running into a local Postgres already sitting on
5432, so the container maps to 5544 to stay out of its way. If you don't have that
conflict, you can change it back in `docker-compose.yml` and `.env`.

## The web app

There's a React frontend in [`web/`](./web) that does everything above in a browser instead
of with curl: create accounts, post credits and debits, page through history with a type
filter, and move money between accounts. It's Vite + React + TypeScript, with TanStack Query
for the data fetching and Tailwind for styling.

It talks to the API, so start the API first (above), then in a second terminal:

```bash
cd web
npm install
cp .env.example .env      # points at http://localhost:3000 by default
npm run dev
```

That serves the app on http://localhost:5173, which the API already allows via CORS (the
`CORS_ORIGIN` variable in the API's `.env`). `npm run build` produces a static bundle.

Money stays in integer minor units through the frontend too — what you type in rupees is
parsed to paise by string, never floating point, and only formatted back to ₹ for display.

## How it's laid out

Routes stay thin — they validate the request with Zod, call a service, and serialize the
result. The services hold the actual rules and own the database transactions, and nothing
about HTTP leaks into them.

```
src/
  app.ts, server.ts    wiring and startup
  modules/
    accounts/          create account, read balance
    transactions/      post transaction, list history
    transfers/         atomic transfer
  shared/              errors, db client, pagination, serialization
prisma/                schema and the SQL migration
tests/                 functional + concurrency tests (run against real Postgres)
web/                   React frontend (Vite + TypeScript)
```

The account's `balance` is a running total, not something recomputed from the ledger on
every read. It gets updated in the same transaction that writes the ledger row, so the two
can't drift apart — the stored balance always equals the signed sum of that account's
transactions. That keeps balance reads and the "does this debit have the funds" check cheap
instead of summing the whole history each time.

## Concurrency

This is the part worth reading.

Anything that changes a balance runs inside a single database transaction, so the ledger
row and the balance update either both land or neither does.

To stop two debits from spending the same money, the transaction locks the account row
first with `SELECT ... FOR UPDATE`. A second debit on that account has to wait for the
first to commit, so it always reads the real balance before deciding — there's no window
where both pass the funds check against a stale number. Underneath that there's a
`balance >= 0` check constraint as a last line of defence. It's all done in the database;
there's no in-process lock that would fall apart across multiple server instances.

Duplicate `reference_id`s are caught by a unique constraint on `(account_id,
reference_id)`. That constraint is also what makes a retried request safe: the second
insert just fails and comes back as a 409, and nothing moves.

Transfers lock both accounts, but always in id order. Because every transfer takes the
locks in the same order, two transfers going opposite ways between the same pair of
accounts can't end up waiting on each other, so they don't deadlock. A transfer is one
`transfers` row plus the two ledger entries (the debit and the credit) linked back to it,
and the transfer's `reference_id` is unique, so retrying one can't move the money twice.

## Testing

The tests run against a real Postgres rather than mocks, because the behaviour worth testing
here *is* the database behaviour. A global setup creates a separate `ledger_test` database
and runs the migrations, each test starts from truncated tables, and the app is driven over
real HTTP on an ephemeral port so concurrent requests actually run concurrently.

Bring up Postgres (the same container as above) and run:

```bash
npm test
```

The functional tests cover account creation, credits and debits, balances, history ordering
and the type filter, pagination edges, transfers, and every error path — asserting the exact
error-envelope shape each time. The concurrency tests are the ones that back up the section
above:

| Scenario | What it proves |
| --- | --- |
| 100 parallel debits of 200 against a balance of 10,000 | exactly 50 succeed, 50 come back `409`, the balance lands on 0 and never goes negative |
| 50 credits and 50 debits fired at once | the final balance matches both the arithmetic and the ledger sum |
| 50 transfers A→B and 50 B→A at the same time | all succeed, none deadlock, and the total across the two accounts is conserved |
| the same `reference_id` sent 20× in parallel | it applies exactly once; the other 19 come back `409` |

After each of these, the test re-derives every balance from the raw ledger rows and checks
it still equals the stored balance — the invariant the whole design rests on.

The frontend has its own tests under `web/` (`cd web && npm test`): the rupee-to-paise
conversion — including the classic `0.1 + 0.2` case and rejecting more than two decimals —
form validation, and that an API error actually renders in the UI.

## Errors

Every error comes back in the same shape:

```json
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "...", "details": {} } }
```

The codes map to status like this: 400 for JSON that won't parse, 404 for a missing
account, 409 for conflicts (duplicate reference, not enough balance), 422 for input that's
well-formed but invalid, and 500 for anything unexpected — without leaking internals. The
full mapping and the edge cases I settled on are in [ASSUMPTIONS.md](./ASSUMPTIONS.md).

## Things I left out

No authentication — it's outside the scope here, but it's the first thing you'd add before
this handled real traffic, along with per-account authorization. Money goes over the wire
as a JSON number, which is fine at these sizes; past a point you'd send it as a string to
avoid any float precision risk. And a duplicate comes back as a 409 rather than replaying
the original response, which is the simpler of the two defensible options.

## When something breaks

- **`P1010` or a refused connection during migrate** — something else is on port 5432 and
  `localhost` is resolving to it. Point `DATABASE_URL` at 5544 and make sure the container
  is running.
- **`DATABASE_URL not found`** — you skipped `cp .env.example .env`.
- **Prisma errors after a schema change** — run `npm run prisma:generate`.
- **Port 3000 already taken** — set `PORT` in `.env`.
```
