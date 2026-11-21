import type { Request, Response } from 'express';
import { app } from '../src/app.js';
import { ensureIndexes } from '../src/lib/db.js';

let indexesPromise: Promise<void> | null = null;

export default async function handler(req: Request, res: Response) {
  const originalUrl = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string | undefined;
  if (originalUrl) {
    req.url = originalUrl;
  }
  if (!indexesPromise) {
    indexesPromise = ensureIndexes().catch((err) => {
      console.error('Failed to ensure database indexes:', err);
    });
  }
  return app(req, res);
}
