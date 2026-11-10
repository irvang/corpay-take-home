import express from 'express';
import type { ErrorRequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { auth } from './auth';
import { getInvoice, listAudit, listDemoUsers, listEvents, listInvoices } from './db/queries';
import { decide } from './decide';

export function createApp(db: DatabaseSync) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/demo-users', (_req, res) => {
    res.json(listDemoUsers(db));
  });

  app.use('/api', auth(db));

  app.get('/api/me', (_req, res) => {
    res.json(res.locals.actor);
  });

  app.get('/api/invoices', (_req, res) => {
    res.json(listInvoices(db, res.locals.actor));
  });

  app.get('/api/audit', (_req, res) => {
    if (res.locals.actor.role !== 'admin') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only admins can view the audit log' } });
      return;
    }
    res.json(listAudit(db, res.locals.actor.companyId));
  });

  app.get('/api/invoices/:id', (req, res) => {
    const id = Number(req.params.id);
    const invoice = Number.isInteger(id) ? getInvoice(db, res.locals.actor.companyId, id) : undefined;
    if (!invoice) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    res.json({ invoice, events: listEvents(db, res.locals.actor.companyId, id) });
  });

  app.post('/api/invoices/:id/decision', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    const result = decide(db, res.locals.actor, id, req.body, req.get('Idempotency-Key'));
    res.status(result.status).json(result.body);
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  };
  app.use(onError);

  return app;
}
