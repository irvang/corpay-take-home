import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app';
import { hasSchema, openDb } from './db/open';

const dbPath = process.env.DB_PATH ?? resolve(__dirname, '../data/workbench.db');
const webDist = process.env.WEB_DIST ?? resolve(__dirname, '../../web/dist');
const port = Number(process.env.PORT ?? 3000);

const db = existsSync(dbPath) ? openDb(dbPath) : undefined;
if (!db || !hasSchema(db)) {
  console.error(`No schema in ${dbPath}. Run: npm run db:reset`);
  process.exit(1);
}

const app = createApp(db);
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(resolve(webDist, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
