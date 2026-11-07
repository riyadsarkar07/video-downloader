import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat, unlink, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { FORMAT_PRESETS, JOB_TTL_MS, MAX_CONCURRENT_JOBS, MAX_QUEUED_JOBS, TMP_DIR, DOWNLOAD_TIMEOUT_MS } from './config.js';
import { sanitizeFilename } from './security.js';
import { mapYtDlpFailure, parseProgress, spawnDownload } from './ytdlp.js';
import { logger } from './logger.js';
import { assertPublicHost, parsePublicUrl } from './security.js';

const jobs = new Map();
let activeCount = 0;
const queue = [];

function now() {
  return Date.now();
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    error: job.error,
    filename: job.filename,
    ext: job.ext,
    filesize: job.filesize,
    title: job.title,
  };
}

async function ensureTmp() {
  await mkdir(TMP_DIR, { recursive: true });
}

async function removePath(target) {
  if (!target) return;
  try {
    await rm(target, { recursive: true, force: true });
  } catch {
    try {
      await unlink(target);
    } catch {
      /* ignore */
    }
  }
}

async function findOutputFile(dir, preferredExt) {
  const entries = await readdir(dir);
  const files = [];
  for (const name of entries) {
    if (name.endsWith('.part') || name.endsWith('.ytdl') || name.endsWith('.json')) continue;
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isFile() && info.size > 0) {
      files.push({
        full,
        size: info.size,
        mtime: info.mtimeMs,
        ext: path.extname(name).replace('.', '').toLowerCase(),
      });
    }
  }
  if (preferredExt) {
    const match = files.filter((file) => file.ext === preferredExt);
    if (match.length) {
      match.sort((a, b) => b.mtime - a.mtime);
      return match[0];
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return files[0] || null;
}

function finishJob(job, patch) {
  const wasActive = job.status === 'processing';
  Object.assign(job, patch, { updatedAt: now() });
  if (job.status === 'ready' || job.status === 'failed' || job.status === 'expired') {
    if (wasActive) {
      activeCount = Math.max(0, activeCount - 1);
    }
    processQueue();
  }
}

async function runJob(job) {
  await ensureTmp();
  const workDir = path.join(TMP_DIR, job.id);
  await mkdir(workDir, { recursive: true });
  job.workDir = workDir;
  job.status = 'processing';
  job.stage = 'starting';
  job.progress = 5;
  job.updatedAt = now();

  try {
    await assertPublicHost(parsePublicUrl(job.url));
  } catch (error) {
    await removePath(workDir);
    finishJob(job, {
      status: 'failed',
      stage: 'failed',
      progress: 0,
      error: error?.message || 'This URL is no longer allowed.',
    });
    return;
  }

  const preset = FORMAT_PRESETS[job.formatId];
  const outputTemplate = path.join(workDir, '%(title).80s.%(ext)s');
  let timedOut = false;
  let log = '';

  const child = spawnDownload(job.url, outputTemplate, preset, (chunk) => {
    log += chunk;
    if (log.length > 80_000) log = log.slice(-40_000);
    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseProgress(line);
      if (parsed) {
        job.progress = Math.max(job.progress, parsed.percent);
        job.stage = parsed.stage;
        job.updatedAt = now();
      }    }
  });

  job.child = child;

  const killer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, DOWNLOAD_TIMEOUT_MS);

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
    child.on('error', () => resolve(1));
  });
  clearTimeout(killer);
  job.child = null;

  if (job.cancelRequested) {
    await removePath(workDir);
    finishJob(job, {
      status: 'failed',
      stage: 'failed',
      progress: 0,
      error: 'Download was cancelled.',
    });
    return;
  }

  if (timedOut) {
    await removePath(workDir);
    finishJob(job, {
      status: 'failed',
      stage: 'failed',
      progress: 0,
      error: 'Download timed out. Try a shorter video or a lower quality.',
    });
    return;
  }

  const output = await findOutputFile(workDir, preset.ext);
  if (exitCode !== 0 && !(output && output.ext === preset.ext)) {
    await removePath(workDir);
    const mapped = mapYtDlpFailure(log, exitCode);
    finishJob(job, {
      status: 'failed',
      stage: 'failed',
      progress: 0,
      error: mapped.message,
    });
    return;
  }

  if (!output) {
    await removePath(workDir);
    finishJob(job, {
      status: 'failed',
      stage: 'failed',
      progress: 0,
      error: 'Processing finished but no file was produced. The source may be restricted.',
    });
    return;
  }

  const ext = path.extname(output.full).replace('.', '').toLowerCase() || preset.ext;
  const filename = sanitizeFilename(job.title, 'download') + '.' + ext;

  finishJob(job, {
    status: 'ready',
    stage: 'ready',
    progress: 100,
    filePath: output.full,
    filename,
    ext,
    filesize: output.size,
    error: null,
  });
}

function processQueue() {
  while (activeCount < MAX_CONCURRENT_JOBS && queue.length > 0) {
    const job = queue.shift();
    if (!job || job.status !== 'queued') continue;
    activeCount += 1;
    runJob(job).catch((error) => {
      logger.error(`Job ${job.id} crashed`, error);
      finishJob(job, {
        status: 'failed',
        stage: 'failed',
        progress: 0,
        error: 'An unexpected error occurred while processing this download.',
      });
    });
  }
}

function fingerprint(url, formatId) {
  return `${url}::${formatId}`;
}

export function createJob({ url, formatId, title }) {
  const preset = FORMAT_PRESETS[formatId];
  if (!preset) {
    const error = new Error('Unknown format selection.');
    error.code = 'BAD_FORMAT';
    throw error;
  }

  const key = fingerprint(url, formatId);
  for (const existing of jobs.values()) {
    const live = existing.status === 'queued' || existing.status === 'processing';
    if (live && existing.fingerprint === key) {
      return existing;
    }
  }

  const pending = queue.reduce((count, item) => (item?.status === 'queued' ? count + 1 : count), 0);
  if (pending >= MAX_QUEUED_JOBS) {
    const error = new Error('The download queue is full. Please try again in a moment.');
    error.code = 'QUEUE_FULL';
    throw error;
  }

  const job = {
    id: randomUUID(),
    url,
    formatId,
    fingerprint: key,
    title: title || 'download',
    status: 'queued',
    stage: 'queued',
    progress: 0,
    error: null,
    filename: null,
    filePath: null,
    ext: preset.ext,
    filesize: null,
    workDir: null,
    child: null,
    cancelRequested: false,
    createdAt: now(),
    updatedAt: now(),
    downloadedAt: null,
  };

  jobs.set(job.id, job);
  queue.push(job);
  processQueue();
  return job;
}

export function cancelJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  if (job.status === 'ready' || job.status === 'failed' || job.status === 'expired') {
    return job;
  }
  job.cancelRequested = true;
  job.updatedAt = now();
  if (job.child) {
    try {
      job.child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
  if (job.status === 'queued') {
    finishJob(job, {
      status: 'failed',
      stage: 'failed',
      progress: 0,
      error: 'Download was cancelled.',
    });
  }
  return job;
}

export function openJobFile(job) {
  if (!job?.filePath) return null;
  job.downloadedAt = now();
  return createReadStream(job.filePath);
}

export async function cleanupExpired() {
  const cutoff = now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    const stale = job.updatedAt < cutoff;
    const consumed = job.status === 'ready' && job.downloadedAt && now() - job.downloadedAt > 60_000;
    if (!stale && !consumed) continue;

    if (job.status === 'processing') {
      job.cancelRequested = true;
      try {
        job.child?.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      continue;
    }

    job.status = 'expired';
    const index = queue.indexOf(job);
    if (index !== -1) queue.splice(index, 1);
    await removePath(job.workDir);
    jobs.delete(id);
  }
}

export async function sweepOrphans() {
  try {
    await ensureTmp();
    const entries = await readdir(TMP_DIR);
    for (const name of entries) {
      if (jobs.has(name)) continue;
      await removePath(path.join(TMP_DIR, name));
    }
  } catch (error) {
    logger.warn('Temp sweep failed', error.message);
  }
}
