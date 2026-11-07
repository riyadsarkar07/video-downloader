import type { Platform } from '@/lib/types';

const PATTERNS: Array<{ id: Platform; tests: RegExp[] }> = [
  {
    id: 'youtube',
    tests: [
      /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i,
    ],
  },
  {
    id: 'facebook',
    tests: [/facebook\.com/i, /fb\.watch/i, /fb\.com/i],
  },
  {
    id: 'instagram',
    tests: [/instagram\.com/i, /instagr\.am/i],
  },
  {
    id: 'tiktok',
    tests: [/tiktok\.com/i],
  },
  {
    id: 'twitter',
    tests: [/(?:x\.com|twitter\.com)\//i],
  },
  {
    id: 'reddit',
    tests: [/reddit\.com/i, /redd\.it/i],
  },
  {
    id: 'vimeo',
    tests: [/vimeo\.com/i],
  },
];

const TRACKING_PARAMS = [
  'igsh',
  'igshid',
  'mibextid',
  'fbclid',
  'gclid',
  'si',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
];

export function stripTrackingParams(input: string): string {
  try {
    const url = new URL(input);
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMS.includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return input;
  }
}

export function canonicalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0]?.match(/^([A-Za-z0-9_-]{11})/);
      if (id) return `https://www.youtube.com/watch?v=${id[1]}`;
    }
    if (host === 'm.youtube.com') url.hostname = 'www.youtube.com';
    if (host === 'mobile.twitter.com' || host === 'twitter.com') url.hostname = 'x.com';
    return url.toString();
  } catch {
    return input;
  }
}

export function cleanInputUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return canonicalizeUrl(stripTrackingParams(withScheme));
}

export function detectPlatform(url: string): Platform | null {
  const normalized = cleanInputUrl(url);
  if (!normalized) return null;
  for (const platform of PATTERNS) {
    if (platform.tests.some((pattern) => pattern.test(normalized))) {
      return platform.id;
    }
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return 'generic';
    }
  } catch {
    return null;
  }
  return null;
}

export function isSupportedUrl(url: string): boolean {
  return detectPlatform(url) !== null;
}

export function normalizeUrl(rawUrl: string): string {
  return cleanInputUrl(rawUrl);
}

export const PLATFORM_META: Record<
  Platform,
  { label: string; color: string; ring: string }
> = {
  youtube: { label: 'YouTube', color: '#ff0033', ring: 'ring-[#ff0033]/40' },
  facebook: { label: 'Facebook', color: '#1877f2', ring: 'ring-[#1877f2]/40' },
  instagram: { label: 'Instagram', color: '#e4405f', ring: 'ring-[#e4405f]/40' },
  tiktok: { label: 'TikTok', color: '#25f4ee', ring: 'ring-[#25f4ee]/40' },
  twitter: { label: 'X', color: '#1d9bf0', ring: 'ring-[#1d9bf0]/40' },
  reddit: { label: 'Reddit', color: '#ff4500', ring: 'ring-[#ff4500]/40' },
  vimeo: { label: 'Vimeo', color: '#1ab7ea', ring: 'ring-[#1ab7ea]/40' },
  generic: { label: 'Direct URL', color: '#6366f1', ring: 'ring-brand-400/40' },
};

export const PLATFORM_ORDER: Platform[] = [
  'youtube',
  'facebook',
  'instagram',
  'tiktok',
  'twitter',
  'reddit',
  'vimeo',
];
