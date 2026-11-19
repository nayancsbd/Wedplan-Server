import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL'),
  CLIENT_URL: z.string().url('CLIENT_URL must be a valid URL'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  STRIPE_PREMIUM_PRICE_ID: z.string().min(1, 'STRIPE_PREMIUM_PRICE_ID is required'),
  IMGBB_API_KEY: z.string().min(1, 'IMGBB_API_KEY is required'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email address'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  ADMIN_NAME: z.string().min(1, 'ADMIN_NAME is required'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid or missing environment variables:');
    const fieldErrors = result.error.flatten().fieldErrors;
    for (const [key, errors] of Object.entries(fieldErrors)) {
      if (errors && errors.length > 0) {
        console.error(`  - ${key}: ${errors.join(', ')}`);
      }
    }
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
