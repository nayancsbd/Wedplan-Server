import { app } from '../dist/app.js';
import { ensureIndexes } from '../dist/lib/db.js';

await ensureIndexes();

export default app;
