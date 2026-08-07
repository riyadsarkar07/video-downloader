import type { MediaFormat, MediaInfo, MediaItem, Platform } from '@/lib/types';
import { ExtractionError, DEFAULT_HEADERS } from '@/services/http';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const COBALT_API_KEY = process.env.COBALT_API_KEY?.trim() || '';

const DEFAULT_COBALT_ENDPOINTS = [
  'https://api.cobalt.tools',
  'https://cobalt-api.kwiatekmiki.com',
  'https://cobalt-api.kwiatekmiki.pl',
  'https://co.wuk.sh',
  'https://cobalt-api.guzman.dev',
  'https://cobalt-api.kwiatekmiki.eu',
];

function getCobaltEndpoints(): string[] {
  const envList = process.env.COBALT_API_URL;
  if (envList && envList.trim()) {
    return envList
      .split(',')
      .map((entry) => entry.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }
  return DEFAULT_COBALT_ENDPOINTS;
}

const DEFAULT_CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

function getCorsProxyBuilders(): Array<(url: string) => string> {
  const envList = process.env.CORS_PROXIES;
  if (envList && envList.trim()) {
    return envList
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((template) => (url: string) => template.replace('{url}', encodeURIComponent(url)));
  }
  return DEFAULT_CORS_PROXIES;
}

export interface CobaltPickerEntry {
  url?: string;
  type?: string;
  thumb?: string;
  title?: string;
}

export interface CobaltData {
  status?: string;
  url?: string;
  text?: string;
  title?: string;
  picker?: CobaltPickerEntry[];
}

export interface CobaltRequestOptions {
  url?: string;
  videoQuality?: '2160' | '1440' | '1080' | '720' | '480' | '360';
  audioFormat?: 'mp3' | 'best' | 'm4a' | 'ogg' | 'wav';
  downloadMode?: 'auto' | 'audio' | 'mute';
}

export async function runWithFallbacks<T>(
  primary: () => Promise<T>,
  fallbacks: Array<() => Promise<T>>,
): Promise<T> {
  const errors: unknown[] = [];

  const attempt = async (fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (error) {
      errors.push(error);
      return null;
    }
  };

  const result = await attempt(primary);
  if (result !== null) return result;

  for (const fallback of fallbacks) {
    const attemptResult = await attempt(fallback);
    if (attemptResult !== null) return attemptResult;
  }

  const lastError = errors[errors.length - 1];
  if (lastError instanceof ExtractionError) throw lastError;
  throw new ExtractionError(
    'All extraction sources failed. The platform may be blocking this network, or the content is private. Please try again later.',
    'ALL_FALLBACKS_FAILED',
  );
}

export async function fetchHtmlViaProxies(
  url: string,
  headers: Record<string, string> = {},
): Promise<string | null> {
  const builders = getCorsProxyBuilders();
  for (const build of builders) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const proxiedUrl = build(url);
      const response = await fetch(proxiedUrl, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const text = await response.text();
      if (text && text.trim().length > 200) return text;
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

export async function fetchJsonViaProxies(url: string): Promise<unknown | null> {
  const builders = getCorsProxyBuilders();
  for (const build of builders) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const proxiedUrl = build(url);
      const response = await fetch(proxiedUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const text = await response.text();
      const data = JSON.parse(text) as unknown;
      if (data !== null && typeof data === 'object') return data;
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

async function cobaltPost(endpoint: string, options: CobaltRequestOptions): Promise<CobaltData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    };
    if (COBALT_API_KEY) {
      requestHeaders['Authorization'] = `Bearer ${COBALT_API_KEY}`;
    }
    const response = await fetch(`${endpoint}/api/json`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        url: options.url ?? '',
        downloadMode: options.downloadMode ?? 'auto',
        videoQuality: options.videoQuality ?? '1080',
        audioFormat: options.audioFormat ?? 'mp3',
        filenameStyle: 'pretty',
        disableMetadata: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as CobaltData;
    if (typeof data !== 'object' || data === null || !('status' in data)) return null;
    if (data.status === 'error' || data.status === 'rate-limit') return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCobaltResult(
  url: string,
  options: CobaltRequestOptions = {},
): Promise<CobaltData | null> {
  const payload: CobaltRequestOptions = { ...options, url };
  for (const endpoint of getCobaltEndpoints()) {
    const result = await cobaltPost(endpoint, payload);
    if (result) return result;
  }
  return null;
}

export async function fetchCobaltPicker(url: string): Promise<CobaltData | null> {
  const result = await fetchCobaltResult(url, { videoQuality: '1080' });
  if (!result) return null;
  const picker = Array.isArray(result.picker) ? result.picker.filter((entry) => entry.url) : [];
  if (picker.length > 0) return result;
  if (result.url) return result;
  return null;
}

function looksLikeImage(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url.split('?')[0]) || /\/originals\//i.test(url);
}

function formatForUrl(url: string, index: number, kind: 'video' | 'image', label: string): MediaFormat {
  if (kind === 'image') {
    return {
      id: `cobalt-image-${index}`,
      kind: 'image',
      label,
      quality: 'High-Res',
      ext: looksLikeImage(url) ? (url.toLowerCase().includes('.png') ? 'png' : 'jpg') : 'jpg',
      url,
      size: null,
    };
  }
  return {
    id: `cobalt-video-${index}`,
    kind: 'video',
    label,
    quality: '1080p',
    ext: 'mp4',
    url,
    size: null,
  };
}

export async function extractWithCobalt(
  platform: Platform,
  url: string,
): Promise<MediaInfo | null> {
  const result = await fetchCobaltPicker(url);
  if (!result) return null;

  const picker = Array.isArray(result.picker)
    ? result.picker.filter((entry) => entry.url)
    : [];

  const title = result.title?.trim() || platformLabel(platform);
  const formats: MediaFormat[] = [];
  const items: MediaItem[] = [];

  if (picker.length > 0) {
    picker.forEach((entry, index) => {
      const itemUrl = entry.url as string;
      const isPhoto = (entry.type ?? '').includes('photo') || looksLikeImage(itemUrl);
      const itemLabel = isPhoto ? 'High-Res Photo' : 'Ultra HD Video';
      const format = formatForUrl(itemUrl, index, isPhoto ? 'image' : 'video', itemLabel);
      formats.push(format);
      items.push({
        id: `cobalt-item-${index}`,
        kind: isPhoto ? 'image' : 'video',
        label: `${index + 1}`,
        thumbnail: entry.thumb ?? null,
        formats: [format],
      });
    });
  } else if (result.url) {
    const isPhoto = looksLikeImage(result.url);
    const format = formatForUrl(result.url, 0, isPhoto ? 'image' : 'video', isPhoto ? 'High-Res Photo' : 'Ultra HD Video');
    formats.push(format);
    items.push({
      id: 'cobalt-item-0',
      kind: isPhoto ? 'image' : 'video',
      label: 'Media',
      thumbnail: null,
      formats: [format],
    });
  }

  if (formats.length === 0) return null;

  const thumbnail =
    picker.find((entry) => entry.thumb)?.thumb ??
    items[0]?.thumbnail ??
    null;

  return {
    platform,
    title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author: null,
    formats,
    items,
  };
}

function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    youtube: 'YouTube Video',
    facebook: 'Facebook Post',
    instagram: 'Instagram Post',
    tiktok: 'TikTok Video',
    twitter: 'X / Twitter Post',
    threads: 'Threads Post',
    pinterest: 'Pinterest Pin',
  };
  return labels[platform];
}
