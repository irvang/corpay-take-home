# H1 Approval Workbench

Approvers approve or reject pending invoices for their own company. Every decision is audited, and a stale or repeated request never applies twice.

## Demo

- Preview/build URL: https://corpay-take-home.onrender.com/ (Render free plan: after 15 idle minutes the first visit takes about a minute to wake, and the demo data resets).
- Five-minute demo path: see [Five-minute demo](#five-minute-demo) below.
- Setup/run command if no preview: `docker build -t h1-workbench .`, then `docker run --rm -p 3000:3000 h1-workbench`, then open http://localhost:3000.

### Seeded users (all synthetic)

| Id  | User       | Role      | Company               |
| --- | ---------- | --------- | --------------------- |
| 1   | Nina Reyes | requester | Northwind Supply Co.  |
| 2   | Omar Hale  | approver  | Northwind Supply Co.  |
| 3   | Ada Brooks | admin     | Northwind Supply Co.  |
| 4   | Ben Carter | requester | Bluefin Logistics LLC |
| 5   | Lena Ortiz | approver  | Bluefin Logistics LLC |
| 6   | Sam Wu     | admin     | Bluefin Logistics LLC |

Each company has 4 `PENDING` invoices in USD, EUR and JPY. Their ids alternate between the companies (Northwind 1, 3, 5, 7; Bluefin 2, 4, 6, 8), so a guessed neighboring id belongs to the other company.

### Five-minute demo

1. Pick **Omar Hale (approver, Northwind Supply Co.)**. The list shows only Northwind's 4 invoices.
2. Open **Harbor Point Packaging** ($1,250.00, invoice #1) in two browser tabs.
3. In tab 1, click **Approve**. The status becomes `APPROVED`, version 2, and History shows Omar Hale's approval with its time.
4. In tab 2, which still shows version 1, click **Reject**. The conflict banner says the invoice changed, who approved it and when, and the detail refreshes to `APPROVED`, version 2. Nothing was rejected.
5. Switch to **Nina Reyes (requester)**. Her invoices show no Approve or Reject buttons. The server enforces this too; this returns `403 FORBIDDEN`:
   ```sh
   curl -i -X POST http://localhost:3000/api/invoices/3/decision -H "X-Demo-User: 1" -H "Idempotency-Key: demo-1" -H "Content-Type: application/json" -d '{"action":"APPROVE","expectedVersion":1}'
   ```
6. As Omar (Northwind approver), request Bluefin's invoice 2. This returns `404 NOT_FOUND`, the same as an id that doesn't exist:
   ```sh
   curl -i http://localhost:3000/api/invoices/2 -H "X-Demo-User: 2"
   ```
7. Switch to **Ada Brooks (admin)** and open **Audit**: step 3's approval is listed with actor and time. Then run the tests (Node required): `npm --prefix server test`.

## Chosen scope

- Declared time box: 5 hours.
- Approximate time spent: about 5 hours, not counting setup.
- Scope: compact (five hours or less).
- What I completed and deliberately omitted:
  - Completed: an invoice list and detail for each seeded user; the approve/reject command with tenant scope, a server-side role check, expected-version concurrency and idempotency keys; per-invoice history and an admin audit view; exact money with currency; 8 automated API tests; a Docker build.
  - Omitted: real login, creating or editing invoices (they are seeded as `PENDING`), filtering and pagination, live updates, notifications, CI, and approval limits and multi-step policies.

## Run locally

Prerequisites: Node 26.13.0 (npm 11.20.0). Docker is optional.

### Start

With Docker (API and UI on port 3000; the database reseeds on every container start):

```sh
docker build -t h1-workbench .
docker run --rm -p 3000:3000 h1-workbench
```

Without Docker, from the repository root:

```sh
npm --prefix server ci
npm --prefix web ci
npm --prefix server run build
npm --prefix server run db:reset
npm --prefix server run dev
```

Then, in a second terminal, run `npm --prefix web run dev` and open the URL Vite prints; it proxies `/api` to the API on port 3000. `db:reset` deletes and reseeds `server/data/workbench.db`, so it also restarts the demo.

### Test and verification

```sh
npm --prefix server test
npm --prefix server run typecheck
npm --prefix web run build
npm --prefix web run lint
```

The 8 tests ([server/test/decision.test.ts](server/test/decision.test.ts)) use vitest and supertest against an in-memory SQLite database with the real schema, seed and routes:

- no `X-Demo-User` → 401; a valid one → `/api/me` returns that user;
- another company's invoice: absent from the list, `404` on GET and on POST decision, unchanged, no events;
- a requester's approval → `403`, unchanged, no events;
- approving an already approved invoice → `409 INVALID_TRANSITION`, 1 event;
- two approvers on version 1: the first gets 200, the second gets `409 STALE_VERSION` naming the first approver, 1 event;
- the same key and body sent twice → identical 200 responses, version 2, 1 event, 1 stored key;
- the same key with a different body → `422 IDEMPOTENCY_KEY_REUSED`.

## Approach

- Architecture and source of truth: one Express 5 server in TypeScript serves a JSON API and the built React (Vite) UI. A single SQLite file, through Node's built-in `node:sqlite`, is the source of truth. The UI holds no authority; it shows what the server returns after every decision.
- Most important domain/security invariant: the actor's company and role come only from the `users` row the server loads on each request, never from the URL, body or client state. Every invoice and event query filters on that company, so another company's invoice is a 404, not a 403. Only an approver can decide, only on a `PENDING` invoice, and only at the version they opened. A role change takes effect on the user's next request.
- Most important tradeoff: optimistic concurrency and idempotency solve two different failures. `expectedVersion` stops a stale view from overwriting someone else's decision (`409 STALE_VERSION`). An `Idempotency-Key` makes a retry of the same attempt return the original result, instead of a false conflict or a second action. Both are checked inside one `BEGIN IMMEDIATE` transaction, and the status change, the audit row and the stored response commit together. The UI keeps the key after a timeout and offers Retry with the same key.
- Trust boundary: login is simulated. The UI sends `X-Demo-User: <id>`, and the server trusts it to name a seeded user. In production, a verified session or OIDC token would replace the header and map its subject to a `users` row. Authorization already reads only that server-loaded row, so nothing else changes.
- Deployment approach and known limitation: a multi-stage Docker image (`node:26.13.0-slim`) runs the API and serves the built UI on port 3000. The hosted preview runs the same image on Render's free plan, with `/api/health` as its health check. The database is reseeded on every container start, including Render's restarts, deploys and 15-minute idle spin-downs, so decisions do not survive them; production would use a managed database with migrations.

## Development tools

- Editor, CLI, frameworks, test/evaluation harnesses: VS Code; Node 26 with `node:sqlite`; Express 5; React 19 with Vite 8; TypeScript; vitest and supertest; ESLint; Docker.
- AI/model/agents used: Claude Code (Claude Opus 5.5) in two places: the Claude desktop app for the build plan, the server skeleton and a browser check of the demo, and the VS Code extension for the rest of the build. A researcher subagent drafted the build plan.
- If AI materially contributed:
  - Contribution: Claude drafted the build plan and wrote most of the code, including the order of checks in the decision command: validate, role, transaction, idempotency lookup, company-scoped load, version, status, update, audit row, stored response.
  - Correction: the plan's tenant test checked only that GET on another company's invoice returns 404, but it was scheduled before that route existed, and Express's default 404 would have passed it. The test now also requires the `NOT_FOUND` error code, and the GET check was added only once the route existed. Separately, an in-memory check showed the first error handler turned malformed JSON into a 500; it now returns 400.
  - Verification: each change was proposed as a diff and approved before it was applied; the typecheck and tests ran after every step; queries were exercised against in-memory SQLite; and I walked the demo path by hand.
  - Added review burden: reading every proposed diff, and removing additions nobody asked for (for example, a logging line in the error handler).

## Known limitations and next step

See [DECISIONS.md](DECISIONS.md) for assumptions, tradeoffs, omissions and next steps. The main limitations are the simulated login, a single-writer SQLite file and the reseed on every container start. The next step is real authentication mapped to `users`, then per-approver approval limits.
