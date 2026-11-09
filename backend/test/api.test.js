import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const fixtureDir = path.join(import.meta.dirname, 'fixtures');
const ytdlp = path.join(fixtureDir, 'fake-ytdlp.sh');
const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'unidown-api-'));
process.env.YTDLP_BIN = ytdlp;
process.env.FFMPEG_BIN = ytdlp;
process.env.DOWNLOAD_TMP_DIR = tmpDir;
process.env.MAX_CONCURRENT_JOBS = '2';
process.env.MAX_QUEUED_JOBS = '5';
process.env.EXTRACT_RATE_LIMIT = '1000';
process.env.DOWNLOAD_RATE_LIMIT = '1000';
process.env.FILE_RATE_LIMIT = '1000';

const { createApp } = await import('../src/app.js');

const app = createApp();
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(tmpDir, { recursive: true, force: true });
});

const get = (route, options) => fetch(`${base}${route}`, options);
const postJson = (route, body) =>
  fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('GET /api/health reports engine versions', async () => {
  const response = await get('/api/health');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.engine, 'yt-dlp');
  assert.ok(body.versions.ytDlp);
  assert.equal(typeof body.cookiesConfigured, 'boolean');
});

test('security headers are present on every response', async () => {
  const response = await get('/api/health');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('POST /api/extract returns normalised metadata', async () => {
  const response = await postJson('/api/extract', { url: 'https://example.com/video?id=1' });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.title, 'Fake Sample Video');
  assert.ok(body.data.formats.length >= 1);
  assert.ok(body.data.formats.some((format) => format.id === 'audio-mp3'));
});

test('POST /api/extract rejects missing and malformed URLs', async () => {
  const missing = await postJson('/api/extract', {});
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).code, 'EMPTY_URL');

  const bad = await postJson('/api/extract', { url: 'not a url at all' });
  assert.equal(bad.status, 400);
});

test('POST /api/extract blocks SSRF targets', async () => {
  for (const url of ['http://127.0.0.1/x', 'http://169.254.169.254/', 'http://[::1]/x', 'file:///etc/passwd']) {
    const response = await postJson('/api/extract', { url });
    assert.equal(response.status, 400, `${url} should be rejected`);
    const body = await response.json();
    assert.equal(body.success, false);
  }
});

test('POST /api/extract rejects malformed JSON', async () => {
  const response = await postJson('/api/extract', '{not json');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'BAD_JSON');
});

test('POST /api/download rejects unknown formats with 400', async () => {
  const response = await postJson('/api/download', { url: 'https://example.com/v?id=1', formatId: 'evil' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'BAD_FORMAT');
});

test('full job lifecycle: create, poll, stream, cancel', async () => {
  const create = await postJson('/api/download', {
    url: 'https://example.com/api?id=1',
    formatId: 'video-best',
    filename: 'api test.mp4',
  });
  assert.equal(create.status, 202);
  const created = await create.json();
  assert.equal(created.success, true);
  const id = created.job.id;

  let job;
  for (let index = 0; index < 60; index += 1) {
    const status = await get(`/api/jobs/${id}`);
    assert.equal(status.status, 200);
    job = (await status.json()).job;
    if (job.status === 'ready' || job.status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(job.status, 'ready', `job did not finish: ${JSON.stringify(job)}`);

  const file = await get(`/api/jobs/${id}/file`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-type'), /video\/mp4/);
  assert.match(file.headers.get('content-disposition'), /attachment/);
  const buffer = Buffer.from(await file.arrayBuffer());
  assert.equal(buffer.toString(), 'FAKE_MP4_PAYLOAD');

  const cancel = await postJson(`/api/jobs/${id}/cancel`, {});
  assert.equal(cancel.status, 200);
  assert.equal((await cancel.json()).job.status, 'ready');
});

test('GET /api/jobs/:id rejects invalid and unknown ids with 404', async () => {
  const invalid = await get('/api/jobs/not-a-uuid');
  assert.equal(invalid.status, 404);
  assert.equal((await invalid.json()).code, 'JOB_NOT_FOUND');

  const missing = await get('/api/jobs/00000000-0000-4000-8000-000000000000');
  assert.equal(missing.status, 404);
});

test('POST /api/jobs/:id/cancel rejects invalid ids', async () => {
  const response = await postJson('/api/jobs/..%2F..%2Fetc%2Fpasswd/cancel', {});
  assert.equal(response.status, 404);
});

test('GET /api/jobs/:id/file returns 404 for unknown job and 409 before ready', async () => {
  const missing = await get('/api/jobs/00000000-0000-4000-8000-000000000000/file');
  assert.equal(missing.status, 404);

  const create = await postJson('/api/download', {
    url: 'https://example.com/slow?id=file&mode=slow',
    formatId: 'video-best',
  });
  const job = (await create.json()).job;
  const notReady = await get(`/api/jobs/${job.id}/file`);
  assert.equal(notReady.status, 409);
  assert.equal((await notReady.json()).code, 'NOT_READY');
  await postJson(`/api/jobs/${job.id}/cancel`, {});
});

test('unknown routes return a JSON 404', async () => {
  const response = await get('/api/does-not-exist');
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'NOT_FOUND');
});

test('legacy /api/download-stream is removed on the frontend proxy layer (410 contract)', async () => {
  // The backend itself has no such route; the Next.js route returns 410. Here we assert the backend 404s.
  const response = await get('/api/download-stream');
  assert.equal(response.status, 404);
});
