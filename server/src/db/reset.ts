import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { applySchema, openDb } from './open';
import { seed } from './seed';

const dbPath = process.env.DB_PATH ?? resolve(__dirname, '../../data/workbench.db');

mkdirSync(dirname(dbPath), { recursive: true });
for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });

const db = openDb(dbPath);
applySchema(db);
seed(db);
for (const table of ['companies', 'users', 'invoices', 'approval_events', 'idempotency_keys']) {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  console.log(`${table}: ${n}`);
}
db.close();
console.log(`Reset ${dbPath}`);
