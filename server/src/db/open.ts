import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema';

export const dbPath = resolve(__dirname, '../../data/workbench.db');

export function openDb(path: string) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA journal_mode = WAL');
  return db;
}

export function applySchema(db: DatabaseSync) {
  db.exec(SCHEMA_SQL);
}

export function hasSchema(db: DatabaseSync) {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'invoices'").get() !== undefined;
}
