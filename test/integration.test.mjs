import test from 'node:test';
import assert from 'node:assert/strict';

// Real end-to-end download tests. These are opt-in because they need network
// access plus working yt-dlp/ffmpeg binaries:
//   RUN_INTEGRATION=1 npm run test:integration
// They never mock progress or files: a test passes only if a real file is produced.
const enabled = process.env.RUN_INTEGRATION === '1';

const SAMPLE_MP4 = 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4';

async function loadDeps() {
  const { createApp } = await import('../backend/src/app.js');
  return createApp();
}

async function startServer() {
  const app = await loadDeps();
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function poll(base, id, timeoutMs = 180_000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`${base}/api/jobs/${id}`);
    last = (await response.json()).job;
    if (last && (last.status === 'ready' || last.status === 'failed')) return last;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`job ${id} did not finish: ${JSON.stringify(last)}`);
}

test('integration suite is opt-in', { skip: !enabled }, async () => {
  assert.ok(enabled);
});

test('real MP4 download produces a valid video file', { skip: !enabled }, async () => {
  const { server, base } = await startServer();
  try {
    const extract = await fetch(`${base}/api/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: SAMPLE_MP4 }),
    });
    assert.equal(extract.status, 200);
    const info = (await extract.json()).data;
    assert.ok(info.formats.some((format) => format.id === 'video-best'));

    const create = await fetch(`${base}/api/download`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: SAMPLE_MP4, formatId: 'video-best', filename: 'integration-video' }),
    });
    assert.equal(create.status, 202);
    const job = (await create.json()).job;

    const done = await poll(base, job.id);
    assert.equal(done.status, 'ready', `download failed: ${JSON.stringify(done)}`);
    assert.equal(done.progress, 100);
    assert.ok(done.filesize > 0);

    const file = await fetch(`${base}/api/jobs/${job.id}/file`);
    assert.equal(file.status, 200);
    assert.match(file.headers.get('content-type'), /video\/mp4/);
    const buffer = Buffer.from(await file.arrayBuffer());
    assert.ok(buffer.length > 10_000, 'file should be a real video, not a stub');
    assert.equal(buffer.subarray(4, 8).toString(), 'ftyp');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('real MP3 export produces a valid audio file', { skip: !enabled }, async () => {
  const { server, base } = await startServer();
  try {
    const create = await fetch(`${base}/api/download`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: SAMPLE_MP4, formatId: 'audio-mp3', filename: 'integration-audio' }),
    });
    assert.equal(create.status, 202);
    const job = (await create.json()).job;

    const done = await poll(base, job.id);
    assert.equal(done.status, 'ready', `mp3 failed: ${JSON.stringify(done)}`);

    const file = await fetch(`${base}/api/jobs/${job.id}/file`);
    assert.match(file.headers.get('content-type'), /audio\/mpeg/);
    const buffer = Buffer.from(await file.arrayBuffer());
    assert.ok(buffer.length > 1_000, 'mp3 should not be empty');
    const header = buffer.subarray(0, 3).toString('latin1');
    assert.ok(header === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0), 'expected an MP3 frame');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('real job exposes genuine, monotonically non-decreasing progress', { skip: !enabled }, async () => {
  const { server, base } = await startServer();
  try {
    const create = await fetch(`${base}/api/download`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: SAMPLE_MP4, formatId: 'video-best' }),
    });
    const job = (await create.json()).job;

    const seen = [];
    let ready = false;
    for (let index = 0; index < 180; index += 1) {
      const response = await fetch(`${base}/api/jobs/${job.id}`);
      const current = (await response.json()).job;
      seen.push(current.progress);
      if (current.status === 'ready') {
        ready = true;
        break;
      }
      if (current.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, 'download never became ready');
    for (let index = 1; index < seen.length; index += 1) {
      assert.ok(seen[index] >= seen[index - 1], `progress regressed: ${seen.join(',')}`);
    }
    assert.equal(seen.at(-1), 100);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
