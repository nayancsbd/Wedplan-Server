import { z } from 'zod';
import { SERVICE_CATEGORIES } from '../types/index.js';

const normalizeCategory = (val: unknown) => {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase().trim();
  if (lower === 'photography' || lower === 'photo' || lower === 'videography') {
    return 'Photography & Videography';
  }
  if (lower === 'venue' || lower === 'venues' || lower === 'wedding venues') {
    return 'Wedding Venues';
  }
  if (
    lower === 'decor' ||
    lower === 'decoration' ||
    lower === 'florist' ||
    lower === 'decoration & florist'
  ) {
    return 'Decoration & Florist';
  }
  if (lower === 'catering' || lower === 'catering services') {
    return 'Catering Services';
  }
  if (
    lower === 'makeup' ||
    lower === 'hair_makeup' ||
    lower === 'styling' ||
    lower === 'makeup & styling'
  ) {
    return 'Makeup & Styling';
  }
  if (lower === 'attire' || lower === 'fashion' || lower === 'wedding fashion') {
    return 'Wedding Fashion';
  }
  return val;
};

const categoryEnum = z.preprocess(normalizeCategory, z.enum(SERVICE_CATEGORIES));

export const createServiceSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const serviceName = obj.serviceName ?? obj.name ?? obj.title;
      const price = obj.price !== undefined ? obj.price : obj.startingPrice;
      return {
        ...obj,
        serviceName,
        price,
      };
    }
    return raw;
  },
  z.object({
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
  })
);

export const updateServiceSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const serviceName = obj.serviceName ?? obj.name ?? obj.title;
      const price = obj.price !== undefined ? obj.price : obj.startingPrice;
      return {
        ...obj,
        ...(serviceName !== undefined ? { serviceName } : {}),
        ...(price !== undefined ? { price } : {}),
      };
    }
    return raw;
  },
  z.object({
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
  })
);

export const toggleAvailabilitySchema = z.object({
  isActive: z.boolean().optional(),
});

const normalizeSortQuery = (val: unknown) => {
  if (typeof val !== 'string') return val;
  const s = val.toLowerCase().trim();
  if (
    s === 'rating' ||
    s === 'highest_rated' ||
    s === 'highest-rated' ||
    s === 'highest_rating' ||
    s === 'top_rated'
  ) {
    return 'rating';
  }
  if (
    s === 'price_asc' ||
    s === 'asc' ||
    s === 'price-asc' ||
    s === 'low_to_high' ||
    s === 'price_low'
  ) {
    return 'price_asc';
  }
  if (
    s === 'price_desc' ||
    s === 'desc' ||
    s === 'price-desc' ||
    s === 'high_to_low' ||
    s === 'price_high'
  ) {
    return 'price_desc';
  }
  if (s === 'newest' || s === 'latest' || s === 'created_desc') {
    return 'newest';
  }
  return val;
};

export const serviceQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.preprocess(normalizeCategory, z.string().trim().optional()),
  location: z.string().trim().optional(),
  sort: z.preprocess(
    normalizeSortQuery,
    z.enum(['price_asc', 'price_desc', 'newest', 'rating', 'highest_rated']).optional().default('newest')
  ),
  sortBy: z.string().trim().optional(),
  sortOrder: z.string().trim().optional(),
  order: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
});
