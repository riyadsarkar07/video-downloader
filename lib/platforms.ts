import type { Platform } from '@/lib/types';

const YOUTUBE_PATTERNS: RegExp[] = [
  /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)?([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
];

const FACEBOOK_PATTERNS: RegExp[] = [
  /facebook\.com\/(?:watch|reel|share\/[rv]|share\/r|groups\/[^/]+\/permalink|photo|photos|videos?|story.php)\/?.+/i,
  /fb\.watch\//i,
  /facebook\.com\/[^/]+\/videos?\/?.+/i,
  /facebook\.com\/reel\/?.+/i,
  /m\.facebook\.com\/(?:watch|reel|share\/[rv])\/.+/i,
];

const INSTAGRAM_PATTERNS: RegExp[] = [
  /instagram\.com\/(?:reel|p|tv|stories)\/[^/?#]+/i,
  /instagram\.com\/(?:reels)\/[^/?#]+/i,
  /instagram\.com\/stories\/[^/?#]+\/[^/?#]+/i,
  /instagr\.am\/(?:reel|p|tv)\/[^/?#]+/i,
];

const TIKTOK_PATTERNS: RegExp[] = [
  /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
  /tiktok\.com\/@[\w.-]+\/photo\/\d+/i,
  /tiktok\.com\/video\/\d+/i,
  /vt\.tiktok\.com\/[A-Za-z0-9]+/i,
  /vm\.tiktok\.com\/[A-Za-z0-9]+/i,
];

const TWITTER_PATTERNS: RegExp[] = [
  /(?:x\.com|twitter\.com)\/[\w.]+\/status\/\d+/i,
  /(?:x\.com|twitter\.com)\/status\/\d+/i,
];

const THREADS_PATTERNS: RegExp[] = [
  /(?:threads\.net|threads\.com)\/@[\w.-]+\/post\/[A-Za-z0-9_-]+/i,
  /(?:threads\.net|threads\.com)\/post\/[A-Za-z0-9_-]+/i,
  /threads\.net\/@[\w.-]+\/post\/[A-Za-z0-9_-]+/i,
  /threads\.com\/@[\w.-]+\/post\/[A-Za-z0-9_-]+/i,
];

const PINTEREST_PATTERNS: RegExp[] = [
  /pinterest\.[a-z.]+\/pin\/[\w-]+\/?/i,
  /pinterest\.[a-z.]+\/pin\/?$/i,
  /pin\.it\//i,
];

const PATTERN_MAP: Record<Platform, RegExp[]> = {
  youtube: YOUTUBE_PATTERNS,
  facebook: FACEBOOK_PATTERNS,
  instagram: INSTAGRAM_PATTERNS,
  tiktok: TIKTOK_PATTERNS,
  twitter: TWITTER_PATTERNS,
  threads: THREADS_PATTERNS,
  pinterest: PINTEREST_PATTERNS,
};

const TRACKING_PARAMS = [
  'igsh',
  'igshid',
  'mibextid',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
  'xtor',
  'cmpid',
];

export function stripTrackingParams(input: string): string {
  try {
    const url = new URL(input);
    const keys = Array.from(url.searchParams.keys());
    let changed = false;
    for (const key of keys) {
      if (TRACKING_PARAMS.some((tracking) => tracking === key.toLowerCase())) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    return changed ? url.toString() : input;
  } catch {
    return input;
  }
}

export function cleanInputUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return stripTrackingParams(withScheme);
}

export function detectPlatform(url: string): Platform | null {
  const normalized = stripTrackingParams(url.trim());
  if (!normalized) return null;
  for (const platform of Object.keys(PATTERN_MAP) as Platform[]) {
    if (PATTERN_MAP[platform].some((pattern) => pattern.test(normalized))) {
      return platform;
    }
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
  { label: string; color: string; ring: string; emoji: string }
> = {
  youtube: {
    label: 'YouTube',
    color: '#ff0033',
    ring: 'ring-[#ff0033]/40',
    emoji: '▶',
  },
  facebook: {
    label: 'Facebook',
    color: '#1877f2',
    ring: 'ring-[#1877f2]/40',
    emoji: 'f',
  },
  instagram: {
    label: 'Instagram',
    color: '#e4405f',
    ring: 'ring-[#e4405f]/40',
    emoji: '◎',
  },
  tiktok: {
    label: 'TikTok',
    color: '#25f4ee',
    ring: 'ring-[#25f4ee]/40',
    emoji: '♪',
  },
  twitter: {
    label: 'X / Twitter',
    color: '#1d9bf0',
    ring: 'ring-[#1d9bf0]/40',
    emoji: '𝕏',
  },
  threads: {
    label: 'Threads',
    color: '#e5e7eb',
    ring: 'ring-slate-200/40',
    emoji: '@',
  },
  pinterest: {
    label: 'Pinterest',
    color: '#e60023',
    ring: 'ring-[#e60023]/40',
    emoji: 'P',
  },
};

export const PLATFORM_ORDER: Platform[] = [
  'youtube',
  'facebook',
  'instagram',
  'tiktok',
  'twitter',
  'threads',
  'pinterest',
];
