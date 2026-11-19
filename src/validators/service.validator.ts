import { z } from 'zod';
import { SERVICE_CATEGORIES } from '../types/index.js';

const categoryEnum = z.enum(SERVICE_CATEGORIES);

export const createServiceSchema = z.object({
  serviceName: z
    .string()
    .trim()
    .min(1, 'Service name is required'),
  category: categoryEnum,
  description: z
    .string()
    .trim()
    .min(1, 'Description is required'),
  price: z.coerce
    .number()
    .gt(0, 'Price must be greater than 0'),
  location: z
    .string()
    .trim()
    .min(1, 'Location is required'),
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .min(1, 'At least 1 image is required')
    .max(5, 'A maximum of 5 images is allowed'),
  isActive: z.boolean().optional().default(true),
});

export const updateServiceSchema = z.object({
  serviceName: z
    .string()
    .trim()
    .min(1, 'Service name is required')
    .optional(),
  category: categoryEnum.optional(),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .optional(),
  price: z.coerce
    .number()
    .gt(0, 'Price must be greater than 0')
    .optional(),
  location: z
    .string()
    .trim()
    .min(1, 'Location is required')
    .optional(),
  images: z
    .array(z.string().url('Each image must be a valid URL'))
    .min(1, 'At least 1 image is required')
    .max(5, 'A maximum of 5 images is allowed')
    .optional(),
  isActive: z.boolean().optional(),
});

export const toggleAvailabilitySchema = z.object({
  isActive: z.boolean().optional(),
});

export const serviceQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  location: z.string().trim().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest']).optional().default('newest'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
});
