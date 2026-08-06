import type { Platform } from '@/lib/types';

const YOUTUBE_PATTERNS: RegExp[] = [
  /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)?([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
];

const FACEBOOK_PATTERNS: RegExp[] = [
  /facebook\.com\/(?:watch|reel|share\/v|groups\/[^/]+\/permalink|photo|photos|videos?)\/?.+/i,
  /fb\.watch\//i,
  /facebook\.com\/[^/]+\/videos?\/?.+/i,
  /facebook\.com\/reel\/?.+/i,
];

const PINTEREST_PATTERNS: RegExp[] = [
  /pinterest\.[a-z.]+\/pin\/[\w-]+\/?/i,
  /pinterest\.[a-z.]+\/pin\/?$/i,
  /pin\.it\//i,
];

const PATTERN_MAP: Record<Platform, RegExp[]> = {
  youtube: YOUTUBE_PATTERNS,
  facebook: FACEBOOK_PATTERNS,
  pinterest: PINTEREST_PATTERNS,
};

export function detectPlatform(url: string): Platform | null {
  const normalized = url.trim();
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
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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
  pinterest: {
    label: 'Pinterest',
    color: '#e60023',
    ring: 'ring-[#e60023]/40',
    emoji: 'P',
  },
};

export const PLATFORM_ORDER: Platform[] = ['youtube', 'facebook', 'pinterest'];
