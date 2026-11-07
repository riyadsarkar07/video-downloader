import { lookup } from 'node:dns/promises';
import net from 'node:net';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const BLOCKED_HOSTS = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata',
  'metadata.google.internal',
  'metadata.google.com',
  'metadata.goog',
  '169.254.169.254',
  'instance-data',
  'host.docker.internal',
  'gateway.docker.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const PLATFORM_HOSTS = [
  { id: 'youtube', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'youtube.googleapis.com'] },
  { id: 'facebook', hosts: ['facebook.com', 'fb.watch', 'fb.com', 'fbcdn.net'] },
  { id: 'instagram', hosts: ['instagram.com', 'instagr.am', 'cdninstagram.com'] },
  { id: 'tiktok', hosts: ['tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com'] },
  { id: 'twitter', hosts: ['twitter.com', 'x.com', 't.co', 'twimg.com'] },
  { id: 'reddit', hosts: ['reddit.com', 'redd.it', 'redditmedia.com'] },
  { id: 'vimeo', hosts: ['vimeo.com', 'player.vimeo.com'] },
  { id: 'dailymotion', hosts: ['dailymotion.com', 'dai.ly'] },
  { id: 'soundcloud', hosts: ['soundcloud.com'] },
  { id: 'twitch', hosts: ['twitch.tv', 'clips.twitch.tv'] },
  { id: 'bilibili', hosts: ['bilibili.com', 'b23.tv'] },
];

export class SecurityError extends Error {
  constructor(message, code = 'SECURITY') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

function hostnameMatches(hostname, allowed) {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  return host === allowed || host.endsWith(`.${allowed}`);
}

export function detectPlatform(hostname) {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  for (const platform of PLATFORM_HOSTS) {
    if (platform.hosts.some((allowed) => hostnameMatches(host, allowed))) {
      return platform.id;
    }
  }
  return 'generic';
}

function ipv4FromHexGroups(groups) {
  if (groups.length < 2) return null;
  const hi = Number.parseInt(groups[0], 16);
  const lo = Number.parseInt(groups[1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

export function isPrivateIp(ip) {
  if (!ip) return true;

  if (ip.includes(':')) {
    const lower = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
    if (lower.startsWith('fe80:') || lower.startsWith('ff')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('2001:db8:')) return true;
    if (lower.startsWith('fd00:ec2:')) return true;
    if (lower.startsWith('2002:')) {
      const embedded = ipv4FromHexGroups(lower.split(':').slice(1, 3));
      if (embedded && isPrivateIp(embedded)) return true;
    }
    if (lower.startsWith('64:ff9b:')) {
      const dotted = lower.split(':').pop();
      if (dotted && dotted.includes('.') && isPrivateIp(dotted)) return true;
    }
    return false;
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0 || a === 255) return true;
  if (a >= 224 && a <= 239) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (ip === '168.63.129.16') return true;
  return false;
}

export function parsePublicUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    throw new SecurityError('Please paste a video URL first.', 'EMPTY_URL');
  }
  if (trimmed.length > 2048) {
    throw new SecurityError('URL is too long.', 'URL_TOO_LONG');
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new SecurityError('Only http and https URLs are allowed.', 'BAD_PROTOCOL');
  }

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new SecurityError('That does not look like a valid URL.', 'INVALID_URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new SecurityError('Only http and https URLs are allowed.', 'BAD_PROTOCOL');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname.includes(' ') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.onion') ||
    hostname.endsWith('.arpa') ||
    hostname.endsWith('.svc')
  ) {
    throw new SecurityError('This host is not allowed.', 'BLOCKED_HOST');
  }
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
    throw new SecurityError('This host is not allowed.', 'BLOCKED_HOST');
  }
  if (/^\d+$/.test(hostname)) {
    throw new SecurityError('Numeric hostnames are not allowed.', 'BLOCKED_HOST');
  }
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new SecurityError('Private network addresses are not allowed.', 'PRIVATE_IP');
  }

  parsed.hash = '';
  parsed.username = '';
  parsed.password = '';
  return parsed;
}

export async function assertPublicHost(parsed) {
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SecurityError('Private network addresses are not allowed.', 'PRIVATE_IP');
    }
    return detectPlatform(hostname);
  }

  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SecurityError('Could not resolve this hostname.', 'DNS_FAILED');
  }

  if (!records.length) {
    throw new SecurityError('Could not resolve this hostname.', 'DNS_FAILED');
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new SecurityError('This URL resolves to a private address.', 'PRIVATE_IP');
    }
  }

  return detectPlatform(hostname);
}

export function sanitizeFilename(input, fallback = 'download') {
  const cleaned = String(input || '')
    .normalize('NFKD')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120)
    .trim();
  const safe = cleaned || fallback;
  return safe.replace(/[. ]+$/g, '') || fallback;
}

export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
