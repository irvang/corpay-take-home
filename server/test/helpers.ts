import { createApp } from '../src/app';
import { applySchema, openDb } from '../src/db/open';
import { seed } from '../src/db/seed';

export function makeTestApp() {
  const db = openDb(':memory:');
  applySchema(db);
  const ids = seed(db);
  return {
    app: createApp(db),
    db,
    ids,
  };
}
