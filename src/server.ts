import { app } from './app.js';
import { env } from './config/env.js';
import { initDbIndexes } from './lib/db.js';

initDbIndexes();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`🔗 Allowed Client URL: ${env.CLIENT_URL}`);
  console.log(`❤️  Health check available at http://localhost:${env.PORT}/api/health`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

const handleShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
