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
import { parseCarouselMedia, parseSingleMedia } from '@/services/mediaUtils';

function canonicalizeThreadsUrl(rawUrl: string): string {
  return rawUrl
    .replace(/^https?:\/\/(www\.)?threads\.(?:net|com)/i, 'https://www.threads.net')
    .split('?')[0]
    .split('#')[0];
}

function looksLikeLoginWall(html: string): boolean {
  return /login_required|log in to continue|sign in to continue/i.test(html);
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
    if (!/(scontent|video|\.mp4|\.webm|fbcdn|cdninstagram)/i.test(resolved)) return;
    seen.add(resolved);
    urls.push(resolved);
  };

  const ogVideo =
    extractMetaTag(html, 'og:video:secure_url') ??
    extractMetaTag(html, 'og:video:url') ??
    extractMetaTag(html, 'og:video');
  if (ogVideo && !/threads\.net/.test(ogVideo)) push(ogVideo);

  const downloadable = html.match(/"downloadable_videos"\s*:\s*\[\s*[^\]]*?\]/g);
  downloadable?.forEach((block) => {
    const urlMatches = block.match(/"source"\s*:\s*"([^"]+)"/g) ?? [];
    urlMatches.forEach((match) => {
      const url = match.match(/"source"\s*:\s*"([^"]+)"/);
      if (url?.[1]) push(url[1]);
    });
  });

  const ld = extractJsonLd(html);
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (/^https?:\/\//.test(value) && /\.(mp4|webm|m4v)(\?|$)/i.test(value)) push(value);
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

  const ogImage =
    extractMetaTag(html, 'og:image:secure_url') ??
    extractMetaTag(html, 'og:image') ??
    extractMetaTag(html, 'twitter:image');
  if (ogImage) push(ogImage);

  return images;
}

function parseThreadsHtml(html: string): MediaInfo | null {
  if (looksLikeLoginWall(html)) return null;

  let items: MediaItem[] = parseCarouselMedia(html);
  if (items.length === 0) {
    const single = parseSingleMedia(html);
    if (single) items = [single];
  }

  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Threads Post';
  const thumbnail =
    items[0]?.thumbnail ??
    extractMetaTag(html, 'og:image:secure_url') ??
    extractMetaTag(html, 'og:image') ??
    null;
  const description = extractMetaTag(html, 'og:description') ?? null;

  const formats: MediaFormat[] = items.flatMap((item) => item.formats);

  if (formats.length === 0) {
    const videos = extractRegexVideos(html);
    const images = extractRegexImages(html);
    if (videos.length > 0) {
      const format: MediaFormat = {
        id: 'th-video-best',
        kind: 'video',
        label: 'Ultra HD Video',
        quality: 'HD',
        ext: 'mp4',
        url: videos[0],
        size: null,
      };
      formats.push(format);
      items = [{ id: 'item-0', kind: 'video', label: '1', thumbnail, formats: [format] }];
    } else if (images.length > 0) {
      images.slice(0, 10).forEach((image, index) => {
        formats.push({
          id: `th-image-${index}`,
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
    platform: 'threads',
    title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author: description,
    formats,
    items,
  };
}

export async function extractThreads(rawUrl: string): Promise<MediaInfo> {
  const canonical = canonicalizeThreadsUrl(rawUrl.trim());
  if (!/threads\.(net|com)\/(?:@[\w.-]+\/)?post\//i.test(canonical)) {
    throw new ExtractionError('This does not look like a valid Threads link.', 'INVALID_LINK');
  }

  try {
    const html = await fetchHtml(canonical, {
      referer: 'https://www.threads.net/',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });
    const parsed = parseThreadsHtml(html);
    if (parsed) return parsed;
  } catch {
    // fall through to proxies and Cobalt
  }

  const proxiedHtml = await fetchHtmlViaProxies(canonical, {
    referer: 'https://www.threads.net/',
  });
  if (proxiedHtml) {
    const parsed = parseThreadsHtml(proxiedHtml);
    if (parsed) return parsed;
  }

  const cobalt = await extractWithCobalt('threads', canonical);
  if (cobalt) return cobalt;

  throw new ExtractionError(
    'We could not find downloadable media in this Threads post. It may be private or only contain text.',
    'THREADS_EXTRACT_FAILED',
  );
}
