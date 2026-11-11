import { mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { applySchema, dbPath, openDb } from './open';
import { seed } from './seed';

mkdirSync(dirname(dbPath), { recursive: true });
for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });

const db = openDb(dbPath);
applySchema(db);
seed(db);
db.close();
console.log(`Reset ${dbPath}`);
