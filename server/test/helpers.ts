import { createApp } from '../src/app';
import { applySchema, openDb } from '../src/db/open';
import { seed } from '../src/db/seed';

export function makeTestApp({ secondApprover = false }: { secondApprover?: boolean } = {}) {
  const db = openDb(':memory:');
  applySchema(db);
  const seeded = seed(db);
  const secondApproverId = secondApprover
    ? Number(
        db
          .prepare("INSERT INTO users (company_id, name, role) VALUES (?, 'Second Approver', 'approver')")
          .run(seeded.northwind.companyId).lastInsertRowid,
      )
    : undefined;
  return { app: createApp(db), db, ids: { ...seeded, secondApproverId } };
}
