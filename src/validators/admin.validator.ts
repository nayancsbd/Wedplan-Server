import { z } from 'zod';
import { SERVICE_CATEGORIES } from '../types/index.js';

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(['customer', 'vendor', 'admin']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const adminServicesQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['approved', 'rejected', 'pending']).optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const updateServiceStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
});
