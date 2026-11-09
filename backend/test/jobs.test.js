import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const fixtureDir = path.join(import.meta.dirname, 'fixtures');
const ytdlp = path.join(fixtureDir, 'fake-ytdlp.sh');
const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'unidown-test-'));
process.env.YTDLP_BIN = ytdlp;
process.env.FFMPEG_BIN = ytdlp;
process.env.DOWNLOAD_TMP_DIR = tmpDir;
process.env.MAX_CONCURRENT_JOBS = '1';
process.env.MAX_QUEUED_JOBS = '2';
process.env.JOB_TTL_MS = '60000';
process.env.DOWNLOAD_TIMEOUT_MS = '15000';

const jobs = await import('../src/jobs.js');
const { parseProgress } = await import('../src/ytdlp.js');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(id, predicate, timeoutMs = 8000) {
  const start = Date.now();
  for (;;) {
    const job = jobs.getJob(id);
    if (job && predicate(job)) return job;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for job ${id}; last=${JSON.stringify(jobs.publicJob(job))}`);
    }
    await wait(100);
  }
}

test.after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

test('parseProgress reads real yt-dlp progress lines only', () => {
  assert.deepEqual(parseProgress('[download]  42.5% of 10MiB at 1MiB/s'), { percent: 42.5, stage: 'downloading' });
  assert.deepEqual(parseProgress('[download] 100% of 10MiB'), { percent: 99, stage: 'downloading' });
  assert.deepEqual(parseProgress('[Merger] Merging formats into "x.mp4"'), { percent: 92, stage: 'processing' });
  assert.deepEqual(parseProgress('[ExtractAudio] Destination: x.mp3'), { percent: 92, stage: 'processing' });
  assert.equal(parseProgress('some unrelated log line'), null);
});

test('createJob rejects unknown formats', () => {
  assert.throws(() => jobs.createJob({ url: 'https://example.com/a', formatId: 'nope', title: 'x' }), (error) => {
    assert.equal(error.code, 'BAD_FORMAT');
    return true;
  });
});

test('createJob dedupes identical live jobs', () => {
  const a = jobs.createJob({ url: 'https://example.com/dup?id=1', formatId: 'video-best', title: 'dup' });
  const b = jobs.createJob({ url: 'https://example.com/dup?id=1', formatId: 'video-best', title: 'dup' });
  assert.equal(a.id, b.id);
  jobs.cancelJob(a.id);
});

test('createJob accepts allowed formats and starts queued', () => {
  const job = jobs.createJob({ url: 'https://example.com/fmt?id=1', formatId: 'audio-mp3', title: 'fmt' });
  assert.ok(jobs.publicJob(job));
  assert.ok(['queued', 'processing'].includes(job.status));
  jobs.cancelJob(job.id);
});

test('queue limit rejects overflow with QUEUE_FULL', async () => {
  const created = [];
  try {
    const first = jobs.createJob({ url: 'https://example.com/slow?id=1&mode=slow', formatId: 'video-best', title: 'slow1' });
    created.push(first);
    await waitFor(first.id, (job) => job.status === 'processing');

    const second = jobs.createJob({ url: 'https://example.com/slow?id=2&mode=slow', formatId: 'video-best', title: 'slow2' });
    created.push(second);
    const third = jobs.createJob({ url: 'https://example.com/slow?id=3&mode=slow', formatId: 'video-best', title: 'slow3' });
    created.push(third);

    assert.throws(
      () => jobs.createJob({ url: 'https://example.com/slow?id=4&mode=slow', formatId: 'video-best', title: 'slow4' }),
      (error) => error.code === 'QUEUE_FULL',
    );
  } finally {
    for (const job of created) jobs.cancelJob(job.id);
    await wait(400);
  }
});

test('a fake download moves queued -> processing -> ready with real progress', async () => {
  const job = jobs.createJob({ url: 'https://example.com/ok?id=1', formatId: 'video-best', title: 'Valid Title' });
  const done = await waitFor(job.id, (item) => item.status === 'ready' || item.status === 'failed');
  assert.equal(done.status, 'ready');
  assert.equal(done.progress, 100);
  assert.ok(done.filesize > 0);
  assert.match(done.filename, /^Valid Title\.mp4$/);
  const stream = jobs.openJobFile(done);
  assert.ok(stream);
  stream.destroy();
});

test('a failing extractor marks the job failed with a mapped error', async () => {
  const job = jobs.createJob({ url: 'https://example.com/x?mode=fail', formatId: 'video-best', title: 'fail' });
  const done = await waitFor(job.id, (item) => item.status === 'failed');
  assert.equal(done.status, 'failed');
  assert.ok(done.error);
});

test('cancel fails a processing job and removes temp files', async () => {
  const job = jobs.createJob({ url: 'https://example.com/slow?id=cancel&mode=slow', formatId: 'video-best', title: 'cancel-me' });
  await waitFor(job.id, (item) => item.status === 'processing');
  const cancelled = jobs.cancelJob(job.id);
  assert.equal(cancelled.cancelRequested, true);
  const done = await waitFor(job.id, (item) => item.status === 'failed');
  assert.match(done.error, /cancel/i);
  if (done.workDir) {
    const remaining = await readdir(done.workDir).catch(() => []);
    assert.equal(remaining.length, 0);
  }
});

test('cancel on an unknown job returns null and on finished jobs is a no-op', async () => {
  assert.equal(jobs.cancelJob('00000000-0000-4000-8000-000000000000'), null);
  const job = jobs.createJob({ url: 'https://example.com/ok?id=2', formatId: 'video-best', title: 'done' });
  const done = await waitFor(job.id, (item) => item.status === 'ready');
  const after = jobs.cancelJob(done.id);
  assert.equal(after.status, 'ready');
});

test('publicJob never leaks internal filesystem paths', async () => {
  const job = jobs.createJob({ url: 'https://example.com/ok?id=3', formatId: 'video-best', title: 'leak' });
  const done = await waitFor(job.id, (item) => item.status === 'ready');
  const exposed = jobs.publicJob(done);
  const serialized = JSON.stringify(exposed);
  assert.ok(!serialized.includes('filePath'));
  assert.ok(!serialized.includes('workDir'));
  assert.ok(!serialized.includes(tmpDir));
});

test('cleanupExpired removes stale finished jobs and their files', async () => {
  const job = jobs.createJob({ url: 'https://example.com/ok?id=4', formatId: 'video-best', title: 'expire' });
  const done = await waitFor(job.id, (item) => item.status === 'ready');
  const workDir = done.workDir;
  done.updatedAt = Date.now() - (Number(process.env.JOB_TTL_MS) + 10_000);
  await jobs.cleanupExpired();
  assert.equal(jobs.getJob(job.id), null);
  const remaining = await readdir(workDir).catch(() => []);
  assert.equal(remaining.length, 0);
});

test('cleanupExpired does not start an expired queued job', async () => {
  const job = jobs.createJob({ url: 'https://example.com/slow?id=expq&mode=slow', formatId: 'video-best', title: 'expq' });
  job.updatedAt = Date.now() - (Number(process.env.JOB_TTL_MS) + 10_000);
  await jobs.cleanupExpired();
  await wait(200);
  assert.equal(jobs.getJob(job.id), null);
});

test('sweepOrphans deletes directories with no matching job', async () => {
  const orphan = path.join(tmpDir, 'orphan-dir');
  await mkdir(orphan, { recursive: true });
  await writeFile(path.join(orphan, 'leftover.part'), 'x');
  await jobs.sweepOrphans();
  const remaining = await readdir(orphan).catch(() => null);
  assert.equal(remaining, null);
});
