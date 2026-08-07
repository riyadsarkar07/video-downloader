import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  extractJsonLd,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';
import { extractWithCobalt, fetchHtmlViaProxies } from '@/services/fallbackEngine';

interface PinVideo {
  url: string;
  quality: string;
  label: string;
  duration: number | null;
}

function resolveImageOriginal(imageUrl: string): string {
  const match = imageUrl.match(/\/i\.pinimg\.com\/(?:[a-z0-9]*x|originals)\//i);
  if (match) {
    return imageUrl.replace(match[0], '/i.pinimg.com/originals/');
  }
  return imageUrl;
}

function extractOrigImageUrl(html: string): string | null {
  const pattern = /"orig"\s*:\s*\{[^}]*?"url"\s*:\s*"((?:https?:)?\\?\/\\?\/[^"\\]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const decoded = jsonUnescape(match[1]).replace(/\\\//g, '/');
    const clean = htmlDecode(decoded);
    if (clean.startsWith('https://')) return clean;
  }
  return null;
}

function extractVideoUrlsFromHtml(html: string): PinVideo[] {
  const results: PinVideo[] = [];
  const seen = new Set<string>();

  const pushVideo = (url: string, quality: string, label: string, duration: number | null = null) => {
    const decoded = jsonUnescape(url).replace(/\\\//g, '/');
    const clean = htmlDecode(decoded);
    if (!clean.startsWith('http')) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    results.push({ url: clean, quality, label, duration });
  };

  const directPatterns = [
    /"V_(\d+P)"\s*:\s*(?:\{"url"\s*:\s*")?((?:https?:)?\\?\/\\?\/[^"\\]+)/g,
    /"V_(\d{3,4}P)"\s*:\s*"((?:https?:)?[^"\\]+)"/g,
    /"V_(\d{3,4}P)"\s*:\s*"((?:https?:)?\\\/\\\/[^"\\]+)"/g,
  ];
  for (const pattern of directPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const quality = match[1];
      const rawUrl = match[2];
      if (!rawUrl) continue;
      const resolved = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
      const label = quality.includes('720') || quality.includes('1080') ? 'HD MP4' : 'SD MP4';
      pushVideo(resolved, quality, label);
    }
  }

  const ogVideo =
    extractMetaTag(html, 'og:video:secure_url') ?? extractMetaTag(html, 'og:video:url') ?? extractMetaTag(html, 'og:video');
  if (ogVideo && /\.(mp4|m4v|webm|mov)/i.test(ogVideo)) {
    pushVideo(ogVideo, 'SD', 'SD MP4');
  }

  return results.sort((a, b) => {
    const aH = Number(a.quality.match(/(\d+)/)?.[1] ?? 0);
    const bH = Number(b.quality.match(/(\d+)/)?.[1] ?? 0);
    return bH - aH;
  });
}

function collectLdJsonImages(html: string): string[] {
  const images: string[] = [];
  const ld = extractJsonLd(html);
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (value.startsWith('https://') && /\.(jpe?g|png|webp)/i.test(value)) images.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  walk(ld);
  return images;
}

function parsePinterestHtml(html: string): MediaInfo | null {
  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Pinterest Pin';
  const ogImage = extractMetaTag(html, 'og:image') ?? extractMetaTag(html, 'twitter:image');
  const ldImages = collectLdJsonImages(html);
  const origImage = extractOrigImageUrl(html);
  const rawThumbnail =
    origImage ??
    ldImages.find((url) => /originals|1200x|736x/.test(url)) ??
    ldImages[0] ??
    ogImage;

  const videos = extractVideoUrlsFromHtml(html);

  const formats: MediaFormat[] = [];

  if (videos.length > 0) {
    for (const [index, video] of videos.slice(0, 3).entries()) {
      formats.push({
        id: `pin-video-${index}`,
        kind: 'video',
        label: index === 0 ? 'Ultra HD Video' : video.label,
        quality: video.quality,
        ext: 'mp4',
        url: video.url,
        size: null,
      });
    }
  }

  if (rawThumbnail && rawThumbnail.startsWith('http')) {
    const original = resolveImageOriginal(rawThumbnail);
    formats.push({
      id: 'pin-image-full',
      kind: 'image',
      label: 'High-Res Photo',
      quality: 'Original',
      ext: 'jpg',
      url: original,
      size: null,
    });
    formats.push({
      id: 'pin-image-preview',
      kind: 'image',
      label: 'Preview JPG',
      quality: '736x',
      ext: 'jpg',
      url: rawThumbnail,
      size: null,
    });
  }

  if (formats.length === 0) return null;

  const firstVideo = videos[0];

  return {
    platform: 'pinterest',
    title,
    thumbnail: rawThumbnail ?? null,
    duration: firstVideo?.duration ?? null,
    width: 1000,
    height: 1500,
    author: null,
    formats,
  };
}

async function scrapePinterest(rawUrl: string): Promise<MediaInfo | null> {
  try {
    const html = await fetchHtml(rawUrl);
    return parsePinterestHtml(html);
  } catch {
    return null;
  }
}

export async function extractPinterest(rawUrl: string): Promise<MediaInfo> {
  const trimmed = rawUrl.trim();
  if (!/pinterest\.[a-z.]+\/pin\/|pin\.it\//i.test(trimmed)) {
    throw new ExtractionError('This does not look like a valid Pinterest pin link.', 'INVALID_LINK');
  }

  const direct = await scrapePinterest(trimmed);
  if (direct) return direct;

  const proxiedHtml = await fetchHtmlViaProxies(trimmed);
  if (proxiedHtml) {
    const parsed = parsePinterestHtml(proxiedHtml);
    if (parsed) return parsed;
  }

  const cobalt = await extractWithCobalt('pinterest', trimmed);
  if (cobalt) return cobalt;

  throw new ExtractionError(
    'We could not find any downloadable media on this pin. It may be private or Pinterest is blocking automated access from this network.',
    'PIN_EXTRACT_FAILED',
  );
}
