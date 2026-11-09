import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeUrl,
  cleanInputUrl,
  detectPlatform,
  isSupportedUrl,
  stripTrackingParams,
} from '../lib/platforms.ts';
import { formatBytes, formatDuration, sanitizeFilename } from '../lib/utils.ts';
import { canCancel, isTerminal, jobTransition, progressPercent } from '../lib/jobProgress.ts';

test('detectPlatform recognises supported hosts and falls back to generic', () => {
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=abc'), 'youtube');
  assert.equal(detectPlatform('https://youtu.be/abc'), 'youtube');
  assert.equal(detectPlatform('https://www.facebook.com/watch?v=1'), 'facebook');
  assert.equal(detectPlatform('https://www.tiktok.com/@a/video/1'), 'tiktok');
  assert.equal(detectPlatform('https://vimeo.com/1'), 'vimeo');
  assert.equal(detectPlatform('https://example.com/a.mp4'), 'generic');
  assert.equal(detectPlatform(''), null);
  assert.equal(detectPlatform('not a url'), null);
});

test('isSupportedUrl requires a resolvable http(s) URL', () => {
  assert.equal(isSupportedUrl('https://example.com/a.mp4'), true);
  assert.equal(isSupportedUrl(''), false);
});

test('cleanInputUrl adds a scheme, strips tracking params and canonicalises', () => {
  assert.equal(cleanInputUrl('youtu.be/abcdefghijk?si=track'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(cleanInputUrl('https://example.com/a?utm_source=x&keep=1'), 'https://example.com/a?keep=1');
  assert.equal(cleanInputUrl(''), '');
  assert.equal(
    cleanInputUrl('https://mobile.twitter.com/u/status/1'),
    'https://x.com/u/status/1',
  );
});

test('stripTrackingParams and canonicalizeUrl are safe on invalid input', () => {
  assert.equal(stripTrackingParams('not a url'), 'not a url');
  assert.equal(canonicalizeUrl('not a url'), 'not a url');
});

test('sanitizeFilename mirrors backend rules for safe output names', () => {
  assert.equal(sanitizeFilename('a/b:c*d?e'), 'a-b-c-d-e');
  assert.equal(sanitizeFilename('   '), 'download');
});

test('formatDuration and formatBytes handle empty and normal values', () => {
  assert.equal(formatDuration(null), '--:--');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatBytes(0), '');
  assert.equal(formatBytes(2048), '2.0 KB');
});

test('progressPercent clamps and rounds real values', () => {
  assert.equal(progressPercent({ progress: 42.6 }), 43);
  assert.equal(progressPercent({ progress: -5 }), 0);
  assert.equal(progressPercent({ progress: 150 }), 100);
  assert.equal(progressPercent({ progress: Number.NaN }), 0);
});

test('isTerminal and canCancel reflect job lifecycle', () => {
  assert.equal(isTerminal('ready'), true);
  assert.equal(isTerminal('failed'), true);
  assert.equal(isTerminal('expired'), true);
  assert.equal(isTerminal('processing'), false);
  assert.equal(canCancel({ status: 'queued' }), true);
  assert.equal(canCancel({ status: 'processing' }), true);
  assert.equal(canCancel({ status: 'ready' }), false);
});

test('jobTransition stops polling and notifies only once', () => {
  const ready = jobTransition('processing', { status: 'ready', progress: 100 });
  assert.deepEqual(ready, { stopPolling: true, clearBusy: true, notice: 'ready' });

  const stillReady = jobTransition('ready', { status: 'ready', progress: 100 });
  assert.equal(stillReady.notice, null);

  const failed = jobTransition('processing', { status: 'failed', progress: 0 });
  assert.deepEqual(failed, { stopPolling: true, clearBusy: true, notice: 'failed' });

  const working = jobTransition('queued', { status: 'processing', progress: 5 });
  assert.deepEqual(working, { stopPolling: false, clearBusy: false, notice: null });

  const expired = jobTransition('processing', { status: 'expired', progress: 0 });
  assert.deepEqual(expired, { stopPolling: true, clearBusy: true, notice: 'failed' });
});
