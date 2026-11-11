import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app';
import { dbPath, hasSchema, openDb } from './db/open';

const port = Number(process.env.PORT ?? 3000);

const db = existsSync(dbPath) ? openDb(dbPath) : undefined;

if (!db || !hasSchema(db)) {
  console.error(`No schema in ${dbPath}. Run: npm run db:reset`);
  process.exit(1);
}

const app = createApp(db, { logRequests: true });
app.use(express.static(resolve(__dirname, '../../web/dist')));

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
