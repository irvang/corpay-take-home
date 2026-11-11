import { useEffect, useState } from 'react';
import { apiFetch } from './api.ts';
import type { AuditEntry } from './types.ts';

export function AuditView({ userId }: { userId: number }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuditEntry[]>(userId, '/api/audit').then(setEntries, (err: Error) => setError(err.message));
  }, [userId]);

  if (error) return <p className="banner error">{error}</p>;
  if (!entries) return <p>Loading…</p>;
  if (entries.length === 0) return <p>No decisions recorded yet.</p>;

  return (
    <table className="audit">
      <thead>
        <tr>
          <th>When</th>
          <th>Who</th>
          <th>Action</th>
          <th>Invoice</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.id}>
            <td>{new Date(entry.created_at).toLocaleString()}</td>
            <td>{entry.actor_name}</td>
            <td>{entry.action}</td>
            <td>
              #{entry.invoice_id} {entry.vendor_name}
            </td>
            <td>
              {entry.from_status} → {entry.to_status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
