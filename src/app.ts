import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
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

app.use(notFoundHandler);

app.use(errorHandler);
