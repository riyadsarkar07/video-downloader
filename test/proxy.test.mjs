import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let upstream;
let baseUrl;

function makeUpstream() {
  return http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, ok: true }));
      return;
    }
    if (req.url === '/api/extract' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.writeHead(422, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: false, code: 'UNAVAILABLE', echoed: body }));
      });
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: false, code: 'NOT_FOUND' }));
  });
}

test.before(async () => {
  upstream = makeUpstream();
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${upstream.address().port}`;
  process.env.BACKEND_URL = baseUrl;
});

test.after(async () => {
  await new Promise((resolve) => upstream.close(resolve));
});

test('proxyJson forwards method, body and status from the backend', async () => {
  const { proxyJson } = await import('../lib/api.ts?case=forward');
  const response = await proxyJson('/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.code, 'UNAVAILABLE');
  assert.match(body.echoed, /example\.com/);
});

test('proxyJson preserves the upstream content-type and no-store cache header', async () => {
  const { proxyJson } = await import('../lib/api.ts?case=head');
  const response = await proxyJson('/api/health');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('proxyToBackend returns a 502 JSON error when the backend is offline', async () => {
  process.env.BACKEND_URL = 'http://127.0.0.1:1';
  const { proxyJson } = await import('../lib/api.ts?case=offline');
  const response = await proxyJson('/api/health');
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'BACKEND_UNREACHABLE');
  process.env.BACKEND_URL = baseUrl;
});
