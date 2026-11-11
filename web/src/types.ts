export type Role = 'requester' | 'approver' | 'admin';
export type InvoiceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type DecisionAction = 'APPROVE' | 'REJECT';

export type DemoUser = {
  id: number;
  name: string;
  role: Role;
  companyName: string;
};

export type Actor = {
  id: number;
  companyId: number;
  role: Role;
  name: string;
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
  action: DecisionAction;
  from_status: InvoiceStatus;
  to_status: InvoiceStatus;
  created_at: string;
  actor_name: string;
};

export type AuditEntry = ApprovalEvent & { vendor_name: string };

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
  current?: Invoice;
  lastEvent?: ApprovalEvent | null;
};
