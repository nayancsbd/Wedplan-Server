import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
  },
});

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) =>
    req.method === 'GET' ||
    req.method === 'OPTIONS' ||
    req.method === 'HEAD' ||
    req.originalUrl.startsWith('/api/webhooks'),
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});
