export const SCHEMA_SQL = `
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('requester', 'approver', 'admin'))
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies,
  vendor_name TEXT NOT NULL,
  total_minor_units INTEGER NOT NULL CHECK (total_minor_units >= 0),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  version INTEGER NOT NULL DEFAULT 1,
  submitted_by INTEGER NOT NULL REFERENCES users
);

CREATE TABLE approval_events (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies,
  invoice_id INTEGER NOT NULL REFERENCES invoices,
  actor_id INTEGER NOT NULL REFERENCES users,
  action TEXT NOT NULL CHECK (action IN ('APPROVE', 'REJECT')),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE idempotency_keys (
  actor_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (actor_id, key)
);

CREATE INDEX invoices_company_id ON invoices (company_id);
CREATE INDEX approval_events_company_invoice ON approval_events (company_id, invoice_id);
`;
