import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { PORT, HOST, TRUST_PROXY, FORMAT_PRESETS, CORS_ORIGINS, TMP_DIR, COOKIES_FILE } from './config.js';
import { assertPublicHost, clientIp, JOB_ID_RE, parsePublicUrl, sanitizeFilename, SecurityError } from './security.js';
import { engineVersions, extractInfo, YtDlpError } from './ytdlp.js';
import { normalizeMedia } from './formats.js';
import { cancelJob, cleanupExpired, createJob, getJob, openJobFile, publicJob, sweepOrphans } from './jobs.js';
import { logger } from './logger.js';
import path from 'node:path';
import { existsSync } from 'node:fs';

function resolveTrustProxy(value) {
  if (value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

const app = express();
app.set('trust proxy', resolveTrustProxy(TRUST_PROXY));
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '16kb' }));

app.use((error, _req, res, next) => {
  if (!error) return next();
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Malformed JSON body.', code: 'BAD_JSON' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body is too large.', code: 'BODY_TOO_LARGE' });
  }
  logger.warn('Request rejected', error.message);
  return res.status(400).json({ success: false, error: 'Invalid request.', code: 'BAD_REQUEST' });
});

const extractLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  message: { success: false, error: 'Too many requests. Please wait a moment and try again.' },
});

const downloadLimiter = rateLimit({
  windowMs: 60_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  message: { success: false, error: 'Too many download requests. Please wait a moment.' },
});

const fileLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  message: { success: false, error: 'Too many file requests. Please wait a moment.' },
});

function fail(res, status, error, code) {
  return res.status(status).json({ success: false, error, code });
}

function mapError(error) {
  if (error instanceof SecurityError) {
    return { status: 400, message: error.message, code: error.code };
  }
  if (error instanceof YtDlpError) {
    const status = error.code === 'TIMEOUT' ? 504 : 422;
    return { status, message: error.message, code: error.code };
  }
  if (
    error?.code === 'TOO_LONG' ||
    error?.code === 'NO_FORMATS' ||
    error?.code === 'BAD_FORMAT' ||
    error?.code === 'QUEUE_FULL'
  ) {
    return { status: error.code === 'QUEUE_FULL' ? 429 : 422, message: error.message, code: error.code };
  }
  logger.error('Unhandled error', error);
  return {
    status: 500,
    message: 'Something went wrong while processing this request.',
    code: 'INTERNAL',
  };
}

function isJobId(value) {
  return typeof value === 'string' && JOB_ID_RE.test(value);
}

let cachedVersions = null;

app.get('/api/health', async (_req, res) => {
  let versions = cachedVersions;
  if (!versions?.ytDlp) {
    versions = await engineVersions();
    if (versions.ytDlp) cachedVersions = versions;
  }
  res.json({
    success: true,
    status: versions.ytDlp ? 'ok' : 'degraded',
    engine: 'yt-dlp',
    versions,
    cookiesConfigured: Boolean(COOKIES_FILE && existsSync(COOKIES_FILE)),
    time: new Date().toISOString(),
  });
});

app.post('/api/extract', extractLimiter, async (req, res) => {
  const started = Date.now();
  try {
    const parsed = parsePublicUrl(req.body?.url);
    const platform = await assertPublicHost(parsed);
    const info = await extractInfo(parsed.toString());
    const data = normalizeMedia(info, platform);
    logger.info(`extract ok ${platform} ${Date.now() - started}ms`);
    res.json({ success: true, data });
  } catch (error) {
    const mapped = mapError(error);
    logger.warn(`extract fail ${mapped.code} ${Date.now() - started}ms`);
    fail(res, mapped.status, mapped.message, mapped.code);
  }
});

app.post('/api/download', downloadLimiter, async (req, res) => {
  try {
    const parsed = parsePublicUrl(req.body?.url);
    await assertPublicHost(parsed);
    const formatId = String(req.body?.formatId || 'video-best');
    if (!FORMAT_PRESETS[formatId]) {
      return fail(res, 400, 'Unknown format selection.', 'BAD_FORMAT');
    }
    const title = sanitizeFilename(req.body?.filename || req.body?.title || 'download', 'download');
    const job = createJob({
      url: parsed.toString(),
      formatId,
      title,
    });
    res.status(202).json({ success: true, job: publicJob(job) });
  } catch (error) {
    const mapped = mapError(error);
    fail(res, mapped.status, mapped.message, mapped.code);
  }
});

app.get('/api/jobs/:id', (req, res) => {
  if (!isJobId(req.params.id)) {
    return fail(res, 404, 'Download job not found or has expired.', 'JOB_NOT_FOUND');
  }
  const job = getJob(req.params.id);
  if (!job) {
    return fail(res, 404, 'Download job not found or has expired.', 'JOB_NOT_FOUND');
  }
  res.json({ success: true, job: publicJob(job) });
});

app.post('/api/jobs/:id/cancel', (req, res) => {
  if (!isJobId(req.params.id)) {
    return fail(res, 404, 'Download job not found or has expired.', 'JOB_NOT_FOUND');
  }
  const job = cancelJob(req.params.id);
  if (!job) {
    return fail(res, 404, 'Download job not found or has expired.', 'JOB_NOT_FOUND');
  }
  res.json({ success: true, job: publicJob(job) });
});

app.get('/api/jobs/:id/file', fileLimiter, (req, res) => {
  if (!isJobId(req.params.id)) {
    return fail(res, 404, 'Download job not found or has expired.', 'JOB_NOT_FOUND');
  }
  const job = getJob(req.params.id);
  if (!job) {
    return fail(res, 404, 'Download job not found or has expired.', 'JOB_NOT_FOUND');
  }
  if (job.status !== 'ready' || !job.filePath) {
    return fail(res, 409, 'This file is not ready yet.', 'NOT_READY');
  }

  const resolved = path.resolve(job.filePath);
  if (!resolved.startsWith(path.resolve(TMP_DIR) + path.sep)) {
    logger.error('Blocked file path outside temp dir', job.id);
    return fail(res, 500, 'The processed file is not available.', 'FILE_GONE');
  }

  const filename = job.filename || `download.${job.ext || 'mp4'}`;
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  res.setHeader('Content-Type', job.ext === 'mp3' ? 'audio/mpeg' : job.ext === 'webm' ? 'video/webm' : 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (job.filesize) res.setHeader('Content-Length', String(job.filesize));

  const stream = openJobFile(job);
  if (!stream) {
    return fail(res, 404, 'The processed file is no longer available.', 'FILE_GONE');
  }
  res.on('close', () => {
    stream.destroy();
  });
  stream.on('error', () => {
    if (!res.headersSent) {
      fail(res, 500, 'Failed to stream the file.', 'STREAM_FAILED');
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
});

app.use((_req, res) => {
  fail(res, 404, 'Not found.', 'NOT_FOUND');
});

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
