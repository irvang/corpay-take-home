import type { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeTestApp } from './helpers';

type App = ReturnType<typeof makeTestApp>['app'];

const postDecision = (app: App, user: number, invoice: number, action: string, version: number, key: string) =>
  request(app)
    .post(`/api/invoices/${invoice}/decision`)
    .set('X-Demo-User', String(user))
    .set('Idempotency-Key', key)
    .send({
      action,
      expectedVersion: version,
    });

const invoiceState = (db: DatabaseSync, id: number) =>
  db.prepare('SELECT status, version FROM invoices WHERE id = ?').get(id);

const eventCount = (db: DatabaseSync, companyId: number) =>
  (db.prepare('SELECT COUNT(*) AS n FROM approval_events WHERE company_id = ?').get(companyId) as { n: number }).n;

const idempotencyCount = (db: DatabaseSync) =>
  (db.prepare('SELECT COUNT(*) AS n FROM idempotency_keys').get() as { n: number }).n;

describe('auth', () => {
  it('returns 401 without X-Demo-User', async () => {
    const { app } = makeTestApp();
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns the actor for a valid X-Demo-User', async () => {
    const { app, ids } = makeTestApp();
    const res = await request(app).get('/api/me').set('X-Demo-User', String(ids.northwind.approverId));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: ids.northwind.approverId,
      companyId: ids.northwind.companyId,
      role: 'approver',
      name: 'Omar Hale',
    });
  });
});

describe('tenant isolation', () => {
  it("returns 404 for another company's invoice and changes nothing", async () => {
    const { app, db, ids } = makeTestApp();
    const bluefinInvoice = ids.bluefin.invoiceIds[0];
    const list = await request(app).get('/api/invoices').set('X-Demo-User', String(ids.northwind.approverId));
    expect(list.status).toBe(200);
    const listedIds: number[] = list.body.map((invoice: { id: number }) => invoice.id);
    expect(listedIds.length).toBeGreaterThan(0);
    expect(listedIds.filter((id) => ids.bluefin.invoiceIds.includes(id))).toEqual([]);
    const get = await request(app)
      .get(`/api/invoices/${bluefinInvoice}`)
      .set('X-Demo-User', String(ids.northwind.approverId));

    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe('NOT_FOUND');
    const res = await postDecision(app, ids.northwind.approverId, bluefinInvoice, 'APPROVE', 1, 'tenant-1');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(invoiceState(db, bluefinInvoice)).toEqual({
      status: 'PENDING',
      version: 1,
    });

    expect(eventCount(db, ids.bluefin.companyId)).toBe(0);
  });
});

describe('role check', () => {
  it('returns 403 when a requester tries to approve and changes nothing', async () => {
    const { app, db, ids } = makeTestApp();
    const invoice = ids.northwind.invoiceIds[0];
    const res = await postDecision(app, ids.northwind.requesterId, invoice, 'APPROVE', 1, 'role-1');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(invoiceState(db, invoice)).toEqual({
      status: 'PENDING',
      version: 1,
    });

    expect(eventCount(db, ids.northwind.companyId)).toBe(0);
  });
});

describe('already approved', () => {
  it('returns 409 INVALID_TRANSITION when approving again with the current version', async () => {
    const { app, db, ids } = makeTestApp();
    const invoice = ids.northwind.invoiceIds[0];
    const first = await postDecision(app, ids.northwind.approverId, invoice, 'APPROVE', 1, 'key-a');
    expect(first.status).toBe(200);
    expect(first.body.invoice.version).toBe(2);
    const second = await postDecision(app, ids.northwind.approverId, invoice, 'APPROVE', 2, 'key-b');
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_TRANSITION');
    expect(second.body.current.status).toBe('APPROVED');
    expect(eventCount(db, ids.northwind.companyId)).toBe(1);
  });
});

describe('two approvers', () => {
  it('returns 409 STALE_VERSION to the second approver and says who changed it', async () => {
    const { app, db, ids } = makeTestApp();

    const secondApproverId = Number(
      db
        .prepare("INSERT INTO users (company_id, name, role) VALUES (?, 'Second Approver', 'approver')")
        .run(ids.northwind.companyId).lastInsertRowid,
    );

    const invoice = ids.northwind.invoiceIds[0];
    const first = await postDecision(app, ids.northwind.approverId, invoice, 'APPROVE', 1, 'approver-1');
    expect(first.status).toBe(200);
    const second = await postDecision(app, secondApproverId, invoice, 'REJECT', 1, 'approver-2');
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('STALE_VERSION');
    expect(second.body.current).toMatchObject({
      status: 'APPROVED',
      version: 2,
    });

    expect(second.body.lastEvent.actor_id).toBe(ids.northwind.approverId);
    expect(eventCount(db, ids.northwind.companyId)).toBe(1);
  });
});

describe('idempotent retry', () => {
  it('replays the stored response for the same key and body without approving twice', async () => {
    const { app, db, ids } = makeTestApp();
    const invoice = ids.northwind.invoiceIds[0];
    const first = await postDecision(app, ids.northwind.approverId, invoice, 'APPROVE', 1, 'retry-1');
    const second = await postDecision(app, ids.northwind.approverId, invoice, 'APPROVE', 1, 'retry-1');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(invoiceState(db, invoice)).toEqual({
      status: 'APPROVED',
      version: 2,
    });

    expect(eventCount(db, ids.northwind.companyId)).toBe(1);
    expect(idempotencyCount(db)).toBe(1);
  });
});

describe('idempotency key reuse', () => {
  it('returns 422 when the same key is sent with a different body', async () => {
    const { app, db, ids } = makeTestApp();
    const invoice = ids.northwind.invoiceIds[0];
    const first = await postDecision(app, ids.northwind.approverId, invoice, 'APPROVE', 1, 'reuse-1');
    expect(first.status).toBe(200);
    const res = await postDecision(app, ids.northwind.approverId, invoice, 'REJECT', 1, 'reuse-1');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(eventCount(db, ids.northwind.companyId)).toBe(1);
  });
});
