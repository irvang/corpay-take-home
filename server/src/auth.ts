import type { RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { findUser } from './db/queries';

export function auth(db: DatabaseSync): RequestHandler {
  return (req, res, next) => {
    const actor = findUser(db, Number(req.get('X-Demo-User')));

    if (!actor) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or unknown X-Demo-User',
        },
      });
      return;
    }

    res.locals.actor = actor;
    next();
  };
}
