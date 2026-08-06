import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  extractJsonLd,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';

interface PinVideo {
  url: string;
  quality: string;
  label: string;
  duration: number | null;
}

function resolveImageOriginal(imageUrl: string): string {
  const match = imageUrl.match(/\/i\.pinimg\.com\/(\d+x|x{2,}|originals|736x|564x|474x)\//);
  if (match) {
    return imageUrl.replace(match[0], '/i.pinimg.com/originals/');
  }
  return imageUrl;
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

export async function extractPinterest(rawUrl: string): Promise<MediaInfo> {
  const trimmed = rawUrl.trim();
  if (!/pinterest\.[a-z.]+\/pin\/|pin\.it\//i.test(trimmed)) {
    throw new ExtractionError('This does not look like a valid Pinterest pin link.', 'INVALID_LINK');
  }

  let html = '';
  try {
    html = await fetchHtml(trimmed);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('Unable to reach this Pinterest pin.', 'PIN_FETCH_FAILED');
  }

  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Pinterest Pin';
  const ogImage = extractMetaTag(html, 'og:image') ?? extractMetaTag(html, 'twitter:image');
  const ldImages = collectLdJsonImages(html);
  const rawThumbnail =
    ldImages.find((url) => /originals|1200x|736x/.test(url)) ?? ldImages[0] ?? ogImage;

  const videos = extractVideoUrlsFromHtml(html);

  const formats: MediaFormat[] = [];

  if (videos.length > 0) {
    for (const [index, video] of videos.slice(0, 3).entries()) {
      formats.push({
        id: `pin-video-${index}`,
        kind: 'video',
        label: video.label,
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
      label: 'Full Resolution JPG',
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

  if (formats.length === 0) {
    throw new ExtractionError(
      'We could not find any downloadable media on this pin.',
      'NO_MEDIA_FOUND',
    );
  }

  const firstVideo = videos[0];
  const width = 1000;
  const height = 1500;

  return {
    platform: 'pinterest',
    title,
    thumbnail: rawThumbnail ?? null,
    duration: firstVideo?.duration ?? null,
    width,
    height,
    author: null,
    formats,
  };
}
