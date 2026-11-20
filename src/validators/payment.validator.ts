import { z } from 'zod';

export const sessionStatusQuerySchema = z.object({
  session_id: z.string().trim().min(1, 'session_id query parameter is required'),
});

export const vendorTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
