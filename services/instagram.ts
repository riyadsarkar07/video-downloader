import type { MediaFormat, MediaInfo, MediaItem } from '@/lib/types';
import {
  ExtractionError,
  extractJsonLd,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';
import { extractWithCobalt, fetchHtmlViaProxies } from '@/services/fallbackEngine';
import { mediaObjectToItem, parseCarouselMedia, parseSingleMedia } from '@/services/mediaUtils';

function looksLikeLoginWall(html: string): boolean {
  return /login_screen|"loginScreen"|log in to continue|login_required/i.test(html);
}

function canonicalizeInstagramUrl(rawUrl: string): string {
  return rawUrl
    .replace(/^https?:\/\/(www\.|m\.|i\.|ipad\.|mobile\.)?instagram\.com/i, 'https://www.instagram.com')
    .replace(/^https?:\/\/instagr\.am/i, 'https://www.instagram.com')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '');
}

function buildCandidates(rawUrl: string): string[] {
  const base = canonicalizeInstagramUrl(rawUrl.trim());
  if (!/instagram\.com\/(?:reel|p|tv|stories|reels)\//i.test(base)) {
    throw new ExtractionError('This does not look like a valid Instagram link.', 'INVALID_LINK');
  }
  const candidates: string[] = [base];
  const embedPath = base.includes('/embed')
    ? base
    : base.replace(/^(https:\/\/www\.instagram\.com\/[^/]+\/[^/]+)\/?$/i, '$1/embed/');
  if (embedPath !== base && /\/embed\/?$/.test(embedPath)) {
    candidates.push(embedPath);
  }
  return Array.from(new Set(candidates));
}

function extractRegexVideos(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: string) => {
    const decoded = jsonUnescape(rawUrl).replace(/\\\//g, '/');
    const clean = htmlDecode(decoded).split('"')[0].trim();
    if (!/^(https?:)?\/\//.test(clean)) return;
    const resolved = clean.startsWith('//') ? `https:${clean}` : clean;
    if (seen.has(resolved)) return;
    if (!/(scontent|video|\.mp4|\.webm|\.m4v|cdninstagram|fbcdn|cdnvideo)/i.test(resolved)) return;
    seen.add(resolved);
    urls.push(resolved);
  };

  const videoTags = html.match(/<video[^>]*src=["']([^"']+)["']/gi);
  videoTags?.forEach((tag) => {
    const src = tag.match(/src=["']([^"']+)["']/i);
    if (src?.[1]) push(src[1]);
  });

  const ogVideo =
    extractMetaTag(html, 'og:video:secure_url') ??
    extractMetaTag(html, 'og:video:url') ??
    extractMetaTag(html, 'og:video');
  if (ogVideo) push(ogVideo);

  return urls;
}

function extractRegexImages(html: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: string) => {
    const decoded = jsonUnescape(rawUrl).replace(/\\\//g, '/');
    const clean = htmlDecode(decoded).split('"')[0].trim();
    if (!/^(https?:)?\/\//.test(clean)) return;
    const resolved = clean.startsWith('//') ? `https:${clean}` : clean;
    if (seen.has(resolved)) return;
    if (!/(scontent|cdninstagram|fbcdn|c\.instagram)/i.test(resolved)) return;
    seen.add(resolved);
    images.push(resolved);
  };

  const ld = extractJsonLd(html);
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (/^https?:\/\//.test(value) && /\.(jpe?g|png|webp)/i.test(value)) push(value);
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

  const ogImage =
    extractMetaTag(html, 'og:image:secure_url') ??
    extractMetaTag(html, 'og:image') ??
    extractMetaTag(html, 'twitter:image');
  if (ogImage) push(ogImage);

  return images;
}

function parseInstagramHtml(html: string): MediaInfo | null {
  if (looksLikeLoginWall(html)) return null;

  let items: MediaItem[] = parseCarouselMedia(html);
  if (items.length === 0) {
    const single = parseSingleMedia(html);
    if (single) items = [single];
  }

  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Instagram Post';
  const thumbnail =
    items[0]?.thumbnail ??
    extractMetaTag(html, 'og:image:secure_url') ??
    extractMetaTag(html, 'og:image') ??
    null;
  const author = extractMetaTag(html, 'og:description') ?? null;

  const formats: MediaFormat[] = items.flatMap((item) => item.formats);

  if (formats.length === 0) {
    const videos = extractRegexVideos(html);
    const images = extractRegexImages(html);
    if (videos.length > 0) {
      const best = videos[0];
      const format: MediaFormat = {
        id: 'ig-video-best',
        kind: 'video',
        label: 'Ultra HD Video',
        quality: 'HD',
        ext: 'mp4',
        url: best,
        size: null,
      };
      formats.push(format);
      items = [
        {
          id: 'item-0',
          kind: 'video',
          label: '1',
          thumbnail,
          formats: [format],
        },
      ];
    } else if (images.length > 0) {
      images.slice(0, 10).forEach((image, index) => {
        formats.push({
          id: `ig-image-${index}`,
          kind: 'image',
          label: index === 0 ? 'High-Res Photo' : `Photo ${index + 1}`,
          quality: 'High-Res',
          ext: 'jpg',
          url: image,
          size: null,
        });
      });
      items = formats.map((format, index) => ({
        id: `item-${index}`,
        kind: 'image',
        label: `${index + 1}`,
        thumbnail: format.url,
        formats: [format],
      }));
    }
  }

  if (formats.length === 0) return null;

  return {
    platform: 'instagram',
    title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author,
    formats,
    items,
  };
}

async function scrapeInstagram(rawUrl: string): Promise<MediaInfo | null> {
  const candidates = buildCandidates(rawUrl);
  let lastInfo: MediaInfo | null = null;

  for (const candidate of candidates) {
    try {
      const html = await fetchHtml(candidate, {
        referer: 'https://www.instagram.com/',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      });
      const parsed = parseInstagramHtml(html);
      if (parsed) {
        lastInfo = parsed;
        if (parsed.items && parsed.items.length > 1) break;
      }
    } catch {
      continue;
    }
  }

  return lastInfo;
}

export async function extractInstagram(rawUrl: string): Promise<MediaInfo> {
  const canonical = canonicalizeInstagramUrl(rawUrl.trim());

  const direct = await scrapeInstagram(rawUrl);
  if (direct) return direct;

  const proxiedHtml = await fetchHtmlViaProxies(canonical, {
    referer: 'https://www.instagram.com/',
  });
  if (proxiedHtml) {
    const proxied = parseInstagramHtml(proxiedHtml);
    if (proxied) return proxied;
  }

  const cobalt = await extractWithCobalt('instagram', canonical);
  if (cobalt) return cobalt;

  throw new ExtractionError(
    'We could not find downloadable media on this Instagram post. It may be private, or Instagram is blocking automated access from this network.',
    'IG_EXTRACT_FAILED',
  );
}
