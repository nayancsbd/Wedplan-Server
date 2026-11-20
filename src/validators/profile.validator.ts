import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').optional(),
    image: z.string().url('Invalid image URL').or(z.literal('')).nullable().optional(),
    businessName: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    bio: z.string().trim().nullable().optional(),
  })
  .strict();
