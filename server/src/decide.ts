import type { DatabaseSync } from 'node:sqlite';
import { getInvoice, lastEvent, type Actor, type Invoice } from './db/queries';

type Result = {
  status: number;
  body: unknown;
};

type SavedResponse = {
  request_hash: string;
  response_status: number;
  response_body: string;
};

const fail = (status: number, code: string, message: string): Result => ({
  status,
  body: {
    error: {
      code,
      message,
    },
  },
});

export function decide(
  db: DatabaseSync,
  actor: Actor,
  invoiceId: number,
  body: unknown,
  key: string | undefined,
): Result {
  const { action, expectedVersion } = (body ?? {}) as {
    action?: unknown;
    expectedVersion?: unknown;
  };

  if (action !== 'APPROVE' && action !== 'REJECT') {
    return fail(400, 'BAD_REQUEST', 'action must be APPROVE or REJECT');
  }

  if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return fail(400, 'BAD_REQUEST', 'expectedVersion must be a positive integer');
  }

  if (!key || key.length > 200) {
    return fail(400, 'BAD_REQUEST', 'Idempotency-Key header is required (max 200 characters)');
  }

  if (actor.role !== 'approver') {
    return fail(403, 'FORBIDDEN', 'Only approvers can approve or reject invoices');
  }

  const requestHash = JSON.stringify({
    invoiceId,
    action,
    expectedVersion,
  });

  const rollback = (result: Result) => {
    db.exec('ROLLBACK');
    return result;
  };

  const conflict = (code: string, message: string, current: Invoice) =>
    rollback({
      status: 409,
      body: {
        error: {
          code,
          message,
        },
        current,
        lastEvent: lastEvent(db, actor.companyId, invoiceId) ?? null,
      },
    });

  db.exec('BEGIN IMMEDIATE');

  try {
    const saved = db
      .prepare(
        'SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE actor_id = ? AND key = ?',
      )
      .get(actor.id, key) as SavedResponse | undefined;

    if (saved) {
      if (saved.request_hash !== requestHash) {
        return rollback(
          fail(422, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different request'),
        );
      }

      return rollback({
        status: saved.response_status,
        body: JSON.parse(saved.response_body),
      });
    }

    const invoice = getInvoice(db, actor.companyId, invoiceId);

    if (!invoice) {
      return rollback(fail(404, 'NOT_FOUND', 'Invoice not found'));
    }

    if (invoice.version !== expectedVersion) {
      return conflict('STALE_VERSION', 'This invoice changed since you opened it', invoice);
    }

    if (invoice.status !== 'PENDING') {
      return conflict('INVALID_TRANSITION', `This invoice is already ${invoice.status}`, invoice);
    }

    const toStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    db.prepare(
      `UPDATE invoices SET status = ?, version = version + 1
       WHERE id = ? AND company_id = ?`,
    ).run(toStatus, invoiceId, actor.companyId);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO approval_events (company_id, invoice_id, actor_id, action, from_status, to_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(actor.companyId, invoiceId, actor.id, action, invoice.status, toStatus, now);

    const result: Result = {
      status: 200,
      body: {
        invoice: getInvoice(db, actor.companyId, invoiceId),
        event: lastEvent(db, actor.companyId, invoiceId),
      },
    };

    db.prepare(
      `INSERT INTO idempotency_keys (actor_id, key, request_hash, response_status, response_body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(actor.id, key, requestHash, result.status, JSON.stringify(result.body), now);

    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
