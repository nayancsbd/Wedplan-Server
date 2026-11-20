import { z } from 'zod';

export const createBookingSchema = z.object({
  serviceId: z
    .string()
    .trim()
    .min(1, 'Service ID is required'),
  eventDate: z
    .string()
    .trim()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    })
    .refine((val) => new Date(val).getTime() > Date.now(), {
      message: 'Event date must be in the future',
    }),
  eventLocation: z
    .string()
    .trim()
    .min(1, 'Event location is required'),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required'),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});
