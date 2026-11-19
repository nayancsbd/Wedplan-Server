import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { jwt } from 'better-auth/plugins';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { db, client } from './db.js';
import { env } from '../config/env.js';

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db, { client }),
  trustedOrigins: [env.CLIENT_URL],
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'customer',
        required: false,
      },
      isBlocked: {
        type: 'boolean',
        defaultValue: false,
        required: false,
        input: false,
      },
      businessName: {
        type: 'string',
        required: false,
      },
      subscriptionPlan: {
        type: 'string',
        defaultValue: 'free',
        required: false,
        input: false,
      },
      subscriptionExpiresAt: {
        type: 'date',
        required: false,
        input: false,
      },
      stripeCustomerId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const allowedRoles = ['customer', 'vendor'];
          const role =
            typeof user.role === 'string' && allowedRoles.includes(user.role)
              ? user.role
              : 'customer';
          return {
            data: {
              ...user,
              role,
            },
          };
        },
      },
      update: {
        before: async (user) => {
          if ('role' in user) {
            delete (user as Record<string, unknown>).role;
          }
          return {
            data: user,
          };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [jwt()],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path === '/update-user' &&
        ctx.body &&
        typeof ctx.body === 'object' &&
        'role' in ctx.body
      ) {
        delete (ctx.body as Record<string, unknown>).role;
      }
      const password = ctx.body?.password || ctx.body?.newPassword;
      if (
        typeof password === 'string' &&
        (ctx.path.startsWith('/sign-up') ||
          ctx.path.startsWith('/reset-password') ||
          ctx.path.startsWith('/change-password') ||
          ctx.path.startsWith('/set-password'))
      ) {
        if (
          password.length < 6 ||
          !/[A-Z]/.test(password) ||
          !/[a-z]/.test(password)
        ) {
          throw new APIError('BAD_REQUEST', {
            message:
              'Password must be at least 6 characters and contain at least one uppercase and one lowercase letter',
          });
        }
      }
    }),
  },
});

export type Auth = typeof auth;
