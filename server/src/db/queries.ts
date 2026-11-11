import type { DatabaseSync } from 'node:sqlite';

export type Role = 'requester' | 'approver' | 'admin';
export type InvoiceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type Actor = {
  id: number;
  companyId: number;
  role: Role;
  name: string;
};

export type DemoUser = {
  id: number;
  name: string;
  role: Role;
  companyName: string;
};

export type Invoice = {
  id: number;
  company_id: number;
  vendor_name: string;
  total_minor_units: number;
  currency: string;
  due_date: string;
  status: InvoiceStatus;
  version: number;
  submitted_by: number;
  submitted_by_name: string;
};

export type ApprovalEvent = {
  id: number;
  company_id: number;
  invoice_id: number;
  actor_id: number;
  action: 'APPROVE' | 'REJECT';
  from_status: InvoiceStatus;
  to_status: InvoiceStatus;
  created_at: string;
  actor_name: string;
};

export type AuditEntry = ApprovalEvent & { vendor_name: string };

export function findUser(db: DatabaseSync, id: number) {
  return db
    .prepare(
      `SELECT id, company_id AS companyId, role, name
       FROM users WHERE id = ?`,
    )
    .get(id) as Actor | undefined;
}

export function listDemoUsers(db: DatabaseSync) {
  return db
    .prepare(
      'SELECT u.id, u.name, u.role, c.name AS companyName FROM users u JOIN companies c ON c.id = u.company_id ORDER BY u.id',
    )
    .all() as DemoUser[];
}

export function listInvoices(db: DatabaseSync, companyId: number) {
  return db
    .prepare(
      'SELECT i.*, u.name AS submitted_by_name FROM invoices i JOIN users u ON u.id = i.submitted_by WHERE i.company_id = ? ORDER BY i.due_date',
    )
    .all(companyId) as Invoice[];
}

export function getInvoice(db: DatabaseSync, companyId: number, id: number) {
  return db
    .prepare(
      'SELECT i.*, u.name AS submitted_by_name FROM invoices i JOIN users u ON u.id = i.submitted_by WHERE i.id = ? AND i.company_id = ?',
    )
    .get(id, companyId) as Invoice | undefined;
}

export function listEvents(db: DatabaseSync, companyId: number, invoiceId: number) {
  return db
    .prepare(
      'SELECT e.*, u.name AS actor_name FROM approval_events e JOIN users u ON u.id = e.actor_id WHERE e.company_id = ? AND e.invoice_id = ? ORDER BY e.id',
    )
    .all(companyId, invoiceId) as ApprovalEvent[];
}

export function lastEvent(db: DatabaseSync, companyId: number, invoiceId: number) {
  return listEvents(db, companyId, invoiceId).at(-1);
}

export function listAudit(db: DatabaseSync, companyId: number) {
  return db
    .prepare(
      'SELECT e.*, u.name AS actor_name, i.vendor_name FROM approval_events e JOIN users u ON u.id = e.actor_id JOIN invoices i ON i.id = e.invoice_id WHERE e.company_id = ? ORDER BY e.id DESC',
    )
    .all(companyId) as AuditEntry[];
}
