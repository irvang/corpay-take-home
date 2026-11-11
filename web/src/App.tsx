import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api.ts';
import { AuditView } from './AuditView.tsx';
import { InvoiceDetail } from './InvoiceDetail.tsx';
import { InvoiceList } from './InvoiceList.tsx';
import { UserPicker } from './UserPicker.tsx';
import type { Actor, DemoUser, Invoice } from './types.ts';
import './App.css';

const STORAGE_KEY = 'demoUserId';

function readStoredUserId(): number | null {
  const value = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function App() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(readStoredUserId);

  useEffect(() => {
    apiFetch<DemoUser[]>(null, '/api/demo-users').then(setUsers, (err: Error) => setUsersError(err.message));
  }, []);

  function switchUser(next: number | null) {
    setUserId(next);

    if (next === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(next));
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>Invoice approvals</h1>
        <UserPicker users={users} userId={userId} onChange={switchUser} />
      </header>
      {usersError && <p className="banner error">{usersError}</p>}
      {userId === null ? <p>Pick a demo user to start.</p> : <Workspace key={userId} userId={userId} />}
    </main>
  );
}

function Workspace({ userId }: { userId: number }) {
  const [me, setMe] = useState<Actor | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'invoices' | 'audit'>('invoices');
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(() => {
    apiFetch<Invoice[]>(userId, '/api/invoices').then(setInvoices, (err: Error) => setError(err.message));
  }, [userId]);

  useEffect(() => {
    apiFetch<Actor>(userId, '/api/me').then(setMe, (err: Error) => setError(err.message));
    loadInvoices();
  }, [userId, loadInvoices]);

  if (error) return <p className="banner error">{error}</p>;
  if (!me) return <p>Loading…</p>;

  return (
    <>
      {me.role === 'admin' && (
        <nav className="tabs">
          <button type="button" aria-pressed={tab === 'invoices'} onClick={() => setTab('invoices')}>
            Invoices
          </button>
          <button type="button" aria-pressed={tab === 'audit'} onClick={() => setTab('audit')}>
            Audit
          </button>
        </nav>
      )}

      {tab === 'audit' ? (
        <AuditView userId={userId} />
      ) : (
        <div className="columns">
          <InvoiceList invoices={invoices} selectedId={selectedId} onSelect={setSelectedId} />
          {selectedId === null ? (
            <p>Select an invoice.</p>
          ) : (
            <InvoiceDetail
              key={selectedId}
              userId={userId}
              role={me.role}
              invoiceId={selectedId}
              onChanged={loadInvoices}
            />
          )}
        </div>
      )}
    </>
  );
}

export default App;
