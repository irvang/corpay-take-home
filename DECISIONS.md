# Assumptions and decisions

## Assumption ledger

| Assumption                                                                       | Why it was necessary                               | Risk if wrong                                                                    | How to validate in a real product                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Login is simulated: the `X-Demo-User` header names a seeded user.                | The brief allows simplified login.                 | Anyone who can reach the API can act as any user.                                | Replace the header with a real login mapped to `users`.          |
| One approval step: any approver in the company can decide any `PENDING` invoice. | No approval policy was specified.                  | Real accounts payable usually needs amount limits and multi-step approvals.      | Review the customer's approval rules with AP managers.           |
| Every user sees all of their company's invoices; only approvers decide.          | No visibility rules beyond the company were given. | A requester may see invoices someone else submitted.                             | Confirm visibility rules with AP managers.                       |
| Approval is not payment.                                                         | The brief says so.                                 | Users may read `APPROVED` as paid.                                               | Test the wording with users and define the hand-off to payments. |
| Invoices arrive already `PENDING`; there is no create or edit flow.              | It keeps the time on the approval decision.        | Real invoices are edited and resubmitted, which changes what a version means.    | Map the real invoice lifecycle.                                  |
| Amounts are integer minor units with a 3-letter currency code.                   | Exact money without floating point.                | The database checks only the code's length, so a bad code would display wrongly. | Validate codes against ISO 4217 at intake.                       |
| Timestamps are UTC, set by the server; the UI shows local time.                  | One clock keeps audit order clear.                 | Exported audit data may be read as local time.                                   | Confirm reporting needs.                                         |

## Key decisions

### Decision: Node's built-in SQLite instead of Postgres

- Context: approvals need real transactions, and a reviewer shouldn't have to set up a database.
- Options considered: Postgres, or Node's built-in `node:sqlite`.
- Chosen approach: `node:sqlite` with one database file.
- Tradeoffs: nothing to install, but one writer at a time. Moving to Postgres would add migrations and a version check in the `UPDATE`.
- Evidence or verification: the 8 tests run on an in-memory database with the same schema, seed and routes.

### Decision: check the version before the status

- Context: two approvers open version 1; one approves, then the other rejects.
- Options considered: status first (both cases look like "already decided"), one generic 409, or version first.
- Chosen approach: a stale version returns `409 STALE_VERSION` with who changed it and when; a current version on a decided invoice returns `409 INVALID_TRANSITION`. The checks and the update run in one write transaction, so nothing changes in between.
- Tradeoffs: the client handles two codes, though both show the same banner.
- Evidence or verification: tests "two approvers" and "already approved"; each ends with exactly one audit event.

### Decision: idempotency keys per user, saving only successes

- Context: the browser can time out after the server has already approved.
- Options considered: no keys (a retry would hit a false conflict), save every response, or save only successes.
- Chosen approach: every decision needs an `Idempotency-Key`. Sending the same key and body again returns the saved result. The same key with a different body returns `422`. Failed requests aren't saved, since they changed nothing.
- Tradeoffs: keys never expire, so a real product would need to clean them up.
- Evidence or verification: tests "idempotent retry" and "idempotency key reuse". In the UI, Retry resends the same key and body.

### Decision: audit rows commit with the status change

- Context: the audit trail must never disagree with the invoice's status.
- Options considered: write the audit row after the commit, or in the same transaction.
- Chosen approach: the status change, the audit row and the saved idempotency response commit in one transaction; any error rolls back all three.
- Tradeoffs: a notification to another system would still need an outbox, which isn't built.
- Evidence or verification: every decision test checks the exact number of audit events: 1 after a successful decision, even with retries, and 0 when nothing succeeded.

### Decision: 404, not 403, for another company's invoice

- Context: ids are guessable numbers, and the seed alternates them between the two companies.
- Options considered: 403 Forbidden, or 404 Not Found.
- Chosen approach: every invoice and event query filters on the user's company, so another company's invoice returns `404 NOT_FOUND`, the same as an id that doesn't exist.
- Tradeoffs: support can't tell "wrong company" from "missing" by the response; the request log shows the user and path for each 404.
- Evidence or verification: test "tenant isolation": a Northwind approver's list has no Bluefin invoices, GET and POST on one return 404, and nothing changes.

### Decision: REST with Express instead of tRPC

- Context: the client and server are both TypeScript, so tRPC could share their types.
- Options considered: REST in Express with hand-written client types, or tRPC.
- Chosen approach: REST, with 7 small routes in `server/src/app.ts`.
- Tradeoffs: the client repeats the server's types in `web/src/types.ts`, and they could drift. tRPC would fix that, but it adds three packages and replaces readable URLs like `/api/invoices/2`. It wouldn't strengthen any check; those stay in `decide()` either way.
- Evidence or verification: the README demo tests the server with plain `curl` on readable URLs, and the 8 tests use the same routes.

## Time-box decisions

- What I intentionally simplified: login through a header, seeded invoices only, no filters or pagination, one server process, a database reseeded on every container start, no CI, and a one-line request log.
- What I refused to simplify because it protects a core invariant: company scope on every invoice and event query, server-side role and state checks, version and idempotency checks, audit rows in the same transaction, and exact money with currency.
- What I would build next with more time: real login, approval limits per approver, Postgres with migrations, CI, structured logs and metrics, and expiring idempotency keys.
- What I would reconsider before production: the single SQLite file, the reseed on start, the trusted demo header, and a release with versioned images and backward-compatible migrations, so a deploy can roll back.
