import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { env } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { ApiError, errorHandler, notFoundHandler } from './middleware/error.js';
import serviceRoutes from './routes/service.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import customerRoutes from './routes/customer.routes.js';
import adminRoutes from './routes/admin.routes.js';
import profileRoutes from './routes/profile.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import { handleStripeWebhook } from './controllers/webhook.controller.js';
import { getProfile } from './controllers/profile.controller.js';
import { authLimiter, writeLimiter } from './middleware/rateLimiter.js';

export { ApiError } from './middleware/error.js';

export const app: Express = express();

app.set('trust proxy', 1);

app.use((req, _res, next) => {
  const originalUrl = (req.headers['x-forwarded-uri'] || req.headers['x-matched-path']) as string | undefined;
  if (originalUrl) {
    req.url = originalUrl;
  }
  next();
});

app.use(helmet());

app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

app.get('/api/auth/token', authLimiter, async (req, res, next) => {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') {
        headers.set(k, v);
      } else if (Array.isArray(v)) {
        headers.set(k, v.join(', '));
      }
    }
    const tokenData = await auth.api.getToken({ headers });
    res.status(200).json(tokenData);
  } catch (err: unknown) {
    const status = (err as { status?: string | number })?.status;
    if (status === 'UNAUTHORIZED' || status === 401) {
      res.status(200).json({ token: null, message: 'Unauthenticated' });
      return;
    }
    next(err);
  }
});

app.all(['/api/auth', '/api/auth/*splat'], authLimiter, toNodeHandler(auth));

app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json', limit: '2mb' }),
  handleStripeWebhook
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', writeLimiter);

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'WedPlan API Server is running',
  });
});

app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'WedPlan API is running',
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    },
  });
});

app.use('/api/services', serviceRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api/me', authenticate, getProfile);

app.use(notFoundHandler);

app.use(errorHandler);
