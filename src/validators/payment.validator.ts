import { z } from 'zod';

export const sessionStatusQuerySchema = z.object({
  session_id: z.string().trim().min(1, 'session_id query parameter is required'),
});
