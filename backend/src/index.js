import { PORT, HOST } from './config.js';
import { createApp } from './app.js';
import { cleanupExpired, sweepOrphans } from './jobs.js';
import { logger } from './logger.js';

const app = createApp();

setInterval(() => {
  cleanupExpired().catch((error) => logger.warn('cleanup failed', error.message));
}, 30_000);

sweepOrphans().catch(() => {});

const server = app.listen(PORT, HOST, () => {
  logger.info(`Downloader API listening on ${HOST}:${PORT}`);
});

server.requestTimeout = 0;
server.headersTimeout = 60_000;
server.keepAliveTimeout = 65_000;
server.timeout = 0;

function shutdown() {
  logger.info('Shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason instanceof Error ? reason.message : reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});
