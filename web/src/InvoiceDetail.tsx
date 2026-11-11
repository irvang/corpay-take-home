import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch, NetworkError } from './api.ts';
import { formatMoney } from './money.ts';
import type { ApprovalEvent, DecisionAction, Invoice, Role } from './types.ts';

type Detail = {
  invoice: Invoice;
  events: ApprovalEvent[];
};

type DecisionResult = {
  invoice: Invoice;
  event: ApprovalEvent;
};

type Attempt = {
  key: string;
  action: DecisionAction;
  expectedVersion: number;
};

type Props = {
  userId: number;
  role: Role;
  invoiceId: number;
  onChanged: () => void;
};

type Notice = {
  kind: 'success' | 'conflict' | 'error' | 'unknown';
  text: string;
};

const formatTime = (iso: string) => new Date(iso).toLocaleString();

function conflictText(message: string, current: Invoice, last: ApprovalEvent | null) {
  const who = last
    ? ` ${last.actor_name} ${last.action === 'APPROVE' ? 'approved' : 'rejected'} it at ${formatTime(last.created_at)}.`
    : '';

  return `${message}.${who} It is now ${current.status}, version ${current.version}.`;
}

export function InvoiceDetail({ userId, role, invoiceId, onChanged }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [retry, setRetry] = useState<Attempt | null>(null);

  const load = useCallback(
    () =>
      apiFetch<Detail>(userId, `/api/invoices/${invoiceId}`).then(setDetail, (err: Error) => setLoadError(err.message)),
    [userId, invoiceId],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function send(attempt: Attempt) {
    setBusy(true);
    setNotice(null);
    setRetry(null);

    try {
      const result = await apiFetch<DecisionResult>(userId, `/api/invoices/${invoiceId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': attempt.key,
        },
        body: JSON.stringify({
          action: attempt.action,
          expectedVersion: attempt.expectedVersion,
        }),
      });

      const addEvent = (current: Detail | null) =>
        current && {
          invoice: result.invoice,
          events: [...current.events, result.event],
        };

      setDetail(addEvent);

      setNotice({
        kind: 'success',
        text: result.event.action === 'APPROVE' ? 'Approved.' : 'Rejected.',
      });

      onChanged();
    } catch (err) {
      if (err instanceof NetworkError) {
        setRetry(attempt);
        setNotice({
          kind: 'unknown',
          text: 'Result unknown: the server did not answer. Retry resends the same request, so it cannot apply twice.',
        });

        return;
      }

      if (err instanceof ApiError && err.status === 409 && err.body.current) {
        setNotice({
          kind: 'conflict',
          text: conflictText(err.message, err.body.current, err.body.lastEvent ?? null),
        });

        load();
        onChanged();
        return;
      }

      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="banner error">{loadError}</p>;
  if (!detail) return <p>Loading…</p>;

  const { invoice, events } = detail;
  const decide = (action: DecisionAction) =>
    send({
      key: crypto.randomUUID(),
      action,
      expectedVersion: invoice.version,
    });

  return (
    <section className="invoice-detail">
      <h2>{invoice.vendor_name}</h2>
      <dl>
        <dt>Invoice</dt>
        <dd>#{invoice.id}</dd>
        <dt>Amount</dt>
        <dd>{formatMoney(invoice.total_minor_units, invoice.currency)}</dd>
        <dt>Currency</dt>
        <dd>{invoice.currency}</dd>
        <dt>Due</dt>
        <dd>{invoice.due_date}</dd>
        <dt>Status</dt>
        <dd>{invoice.status}</dd>
        <dt>Version</dt>
        <dd>{invoice.version}</dd>
        <dt>Submitted by</dt>
        <dd>{invoice.submitted_by_name}</dd>
      </dl>

      {notice && (
        <div className={`banner ${notice.kind}`} role="status">
          {notice.text}
          {retry && (
            <button type="button" disabled={busy} onClick={() => send(retry)}>
              Retry
            </button>
          )}
        </div>
      )}

      {role === 'approver' && invoice.status === 'PENDING' && (
        <div className="actions">
          <button type="button" disabled={busy} onClick={() => decide('APPROVE')}>
            Approve
          </button>
          <button type="button" disabled={busy} onClick={() => decide('REJECT')}>
            Reject
          </button>
        </div>
      )}

      <h3>History</h3>
      {events.length === 0 ? (
        <p>No decisions yet.</p>
      ) : (
        <ol className="history">
          {events.map((event) => (
            <li key={event.id}>
              {formatTime(event.created_at)}: {event.actor_name} {event.action === 'APPROVE' ? 'approved' : 'rejected'}{' '}
              ({event.from_status} → {event.to_status})
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
