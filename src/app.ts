import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { env } from './config/env.js';
import { authenticate, authorize, isPremiumActive } from './middleware/auth.js';
import { ApiError, errorHandler, notFoundHandler } from './middleware/error.js';

export { ApiError } from './middleware/error.js';

export const app: Express = express();

app.use(helmet());

app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

app.all(['/api/auth', '/api/auth/*splat'], toNodeHandler(auth));

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/webhooks/stripe')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/webhooks/stripe')) {
    next();
  } else {
    express.urlencoded({ extended: true })(req, res, next);
  }
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

app.get('/api/me', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      ...req.user,
      isPremiumActive: isPremiumActive(req.user),
    },
  });
});

app.get('/api/test/admin', authenticate, authorize('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin access granted',
    user: req.user,
  });
});

app.get('/api/test/vendor', authenticate, authorize('vendor'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vendor access granted',
    user: req.user,
  });
});

app.get('/api/test/customer', authenticate, authorize('customer'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Customer access granted',
    user: req.user,
  });
});

app.use(notFoundHandler);

app.use(errorHandler);
