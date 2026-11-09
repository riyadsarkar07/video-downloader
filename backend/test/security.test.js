import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPublicHost,
  detectPlatform,
  isPrivateIp,
  JOB_ID_RE,
  parsePublicUrl,
  sanitizeFilename,
  SecurityError,
} from '../src/security.js';

function expectCode(fn, code) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SecurityError, `expected SecurityError, got ${caught}`);
  const allowed = Array.isArray(code) ? code : [code];
  assert.ok(
    allowed.includes(caught.code),
    `expected one of ${allowed.join(', ')}, got ${caught.code}`,
  );
}

const BLOCKED_ADDRESS_CODES = ['BLOCKED_HOST', 'PRIVATE_IP'];

test('parsePublicUrl accepts http and https and normalises whitespace', () => {
  assert.equal(parsePublicUrl('  https://example.com/video.mp4  ').protocol, 'https:');
  assert.equal(parsePublicUrl('http://example.com/video.mp4').protocol, 'http:');
});

test('parsePublicUrl adds a scheme to bare hostnames', () => {
  assert.equal(parsePublicUrl('example.com/video.mp4').protocol, 'https:');
});

test('parsePublicUrl strips credentials, hash and keeps query', () => {
  const parsed = parsePublicUrl('https://user:pass@example.com/v.mp4?x=1#frag');
  assert.equal(parsed.username, '');
  assert.equal(parsed.password, '');
  assert.equal(parsed.hash, '');
  assert.equal(parsed.search, '?x=1');
});

test('parsePublicUrl rejects empty, oversized and non-http schemes', () => {
  expectCode(() => parsePublicUrl(''), 'EMPTY_URL');
  expectCode(() => parsePublicUrl('   '), 'EMPTY_URL');
  expectCode(() => parsePublicUrl('https://example.com/' + 'a'.repeat(2100)), 'URL_TOO_LONG');
  expectCode(() => parsePublicUrl('ftp://example.com/x'), 'BAD_PROTOCOL');
  expectCode(() => parsePublicUrl('file:///etc/passwd'), 'BAD_PROTOCOL');
  expectCode(() => parsePublicUrl('javascript:alert(1)'), 'BAD_PROTOCOL');
  expectCode(() => parsePublicUrl('data:text/html,<script>'), 'BAD_PROTOCOL');
});

test('parsePublicUrl rejects malformed URLs', () => {
  expectCode(() => parsePublicUrl('https://'), 'INVALID_URL');
});

test('parsePublicUrl blocks localhost and private hosts by name', () => {
  for (const host of [
    'http://localhost/x',
    'http://metadata.google.internal/x',
    'http://instance-data/x',
    'http://host.docker.internal/x',
    'http://foo.local/x',
    'http://foo.internal/x',
    'http://foo.onion/x',
    'http://foo.arpa/x',
    'http://foo.svc/x',
  ]) {
    expectCode(() => parsePublicUrl(host), 'BLOCKED_HOST');
  }
});

test('parsePublicUrl blocks IPv4 private and metadata literals', () => {
  for (const host of [
    'http://127.0.0.1/x',
    'http://10.1.2.3/x',
    'http://172.16.0.1/x',
    'http://192.168.1.1/x',
    'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0/x',
    'http://100.64.0.1/x',
    'http://198.18.0.1/x',
    'http://224.0.0.1/x',
    'http://168.63.129.16/x',
  ]) {
    expectCode(() => parsePublicUrl(host), BLOCKED_ADDRESS_CODES);
  }
});

test('parsePublicUrl blocks private IPv6 literals', () => {
  for (const host of [
    'http://[::1]/x',
    'http://[::]/x',
    'http://[fe80::1]/x',
    'http://[fd00::1]/x',
    'http://[2001:db8::1]/x',
    'http://[::ffff:127.0.0.1]/x',
    'http://[64:ff9b::127.0.0.1]/x',
    'http://[2002:7f00:1::]/x',
  ]) {
    expectCode(() => parsePublicUrl(host), BLOCKED_ADDRESS_CODES);
  }
});

test('parsePublicUrl blocks numeric-only hostnames and public IPs are allowed', () => {
  expectCode(() => parsePublicUrl('http://2130706433/x'), 'BLOCKED_HOST');
  assert.equal(parsePublicUrl('https://8.8.8.8/video.mp4').hostname, '8.8.8.8');
  assert.equal(parsePublicUrl('https://[2606:4700::1111]/x').hostname, '[2606:4700::1111]');
});

test('isPrivateIp classifies representative addresses', () => {
  const cases = [
    ['127.0.0.1', true],
    ['10.0.0.1', true],
    ['172.16.5.4', true],
    ['172.32.0.1', false],
    ['192.168.0.1', true],
    ['169.254.169.254', true],
    ['100.64.0.1', true],
    ['198.19.0.1', true],
    ['224.0.0.1', true],
    ['255.255.255.255', true],
    ['168.63.129.16', true],
    ['8.8.8.8', false],
    ['1.1.1.1', false],
    ['::1', true],
    ['::', true],
    ['::ffff:10.0.0.1', true],
    ['fe80::1', true],
    ['fc00::1', true],
    ['fd00:ec2::254', true],
    ['2001:db8::1', true],
    ['2002:0a00:0001::', true],
    ['64:ff9b::127.0.0.1', true],
    ['2606:4700::1111', false],
    ['2001:4860:4860::8888', false],
    ['::ffff:8.8.8.8', false],
    ['not-an-ip', true],
    ['', true],
  ];
  for (const [ip, expected] of cases) {
    assert.equal(isPrivateIp(ip), expected, `isPrivateIp(${ip}) should be ${expected}`);
  }
});

test('assertPublicHost resolves DNS and rejects private answers', async () => {
  const parsed = parsePublicUrl('https://example.com/v.mp4');

  const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
  assert.equal(await assertPublicHost(parsed, { lookupFn: publicLookup }), 'generic');

  const privateLookup = async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '10.0.0.5', family: 4 },
  ];
  let caught;
  try {
    await assertPublicHost(parsed, { lookupFn: privateLookup });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof SecurityError);
  assert.equal(caught.code, 'PRIVATE_IP');

  const failingLookup = async () => {
    throw new Error('ENOTFOUND');
  };
  caught = undefined;
  try {
    await assertPublicHost(parsed, { lookupFn: failingLookup });
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, 'DNS_FAILED');

  const emptyLookup = async () => [];
  caught = undefined;
  try {
    await assertPublicHost(parsed, { lookupFn: emptyLookup });
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, 'DNS_FAILED');
});

test('assertPublicHost rejects private IP literals without DNS', async () => {
  let called = false;
  const lookupFn = async () => {
    called = true;
    return [];
  };
  let caught;
  try {
    await assertPublicHost(new URL('http://10.1.2.3/x'), { lookupFn });
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.code, 'PRIVATE_IP');
  assert.equal(called, false);
});

test('detectPlatform maps known hosts', () => {
  assert.equal(detectPlatform('www.youtube.com'), 'youtube');
  assert.equal(detectPlatform('youtu.be'), 'youtube');
  assert.equal(detectPlatform('facebook.com'), 'facebook');
  assert.equal(detectPlatform('vt.tiktok.com'), 'tiktok');
  assert.equal(detectPlatform('cdn.example.net'), 'generic');
});

test('sanitizeFilename removes unsafe characters and traversal', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), '.-.-etc-passwd');
  assert.equal(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'), 'a-b-c-d-e-f-g-h-i-j');
  assert.equal(sanitizeFilename('  trailing...  '), 'trailing');
  assert.equal(sanitizeFilename(''), 'download');
  assert.equal(sanitizeFilename('   '), 'download');
  assert.equal(sanitizeFilename('\u0000\u001fname'), 'name');
  assert.equal(sanitizeFilename('x'.repeat(500)).length, 120);
  assert.ok(!sanitizeFilename('../../etc/passwd').includes('/'));
});

test('JOB_ID_RE only accepts canonical UUIDs', () => {
  assert.ok(JOB_ID_RE.test('e5f32f89-d5dd-4d60-9ac0-5f688d7bf35a'));
  assert.ok(!JOB_ID_RE.test('not-a-uuid'));
  assert.ok(!JOB_ID_RE.test('../../etc/passwd'));
  assert.ok(!JOB_ID_RE.test('e5f32f89-d5dd-9d60-9ac0-5f688d7bf35a'));
  assert.ok(!JOB_ID_RE.test('e5f32f89-d5dd-0d60-9ac0-5f688d7bf35a'));
});
