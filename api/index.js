import { app } from '../dist/app.js';
import { ensureIndexes } from '../dist/lib/db.js';

let indexesPromise = null;

export default async function handler(req, res) {
  if (!indexesPromise) {
    indexesPromise = ensureIndexes().catch((err) => {
      console.error('Failed to ensure database indexes:', err);
    });
  }
  return app(req, res);
}
