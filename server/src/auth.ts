import type { RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { findUser } from './db/queries';

export function auth(db: DatabaseSync): RequestHandler {
  return (req, res, next) => {
    const id = Number(req.get('X-Demo-User'));
    const actor = Number.isInteger(id) && id > 0 ? findUser(db, id) : undefined;
    if (!actor) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or unknown X-Demo-User' } });
      return;
    }
    res.locals.actor = actor;
    next();
  };
}
