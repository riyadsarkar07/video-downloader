import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';
import { extractWithCobalt, fetchHtmlViaProxies } from '@/services/fallbackEngine';

function canonicalizeXUrl(rawUrl: string): string {
  return rawUrl
    .replace(/^https?:\/\/(mobile\.|m\.)?twitter\.com/i, 'https://x.com')
    .replace(/^https?:\/\/(mobile\.|m\.)?x\.com/i, 'https://x.com')
    .split('#')[0];
}

function extractMp4Urls(html: string): Array<{ url: string; bitrate: number | null }> {
  const results: Array<{ url: string; bitrate: number | null }> = [];
  const seen = new Set<string>();

  const push = (rawUrl: string, bitrate: number | null = null) => {
    const decoded = jsonUnescape(rawUrl).replace(/\\\//g, '/');
    const clean = htmlDecode(decoded).split('"')[0].trim();
    if (!clean.startsWith('http')) return;
    if (seen.has(clean)) return;
    if (!/\.(mp4|m4v)(\?|$)|mime_type=video|video\/mp4/i.test(clean)) return;
    seen.add(clean);
    results.push({ url: clean, bitrate });
  };

  const streamMeta =
    extractMetaTag(html, 'twitter:player:stream:content_type') !== null
      ? extractMetaTag(html, 'twitter:player:stream')
      : null;
  const ogVideo =
    extractMetaTag(html, 'og:video:secure_url') ??
    extractMetaTag(html, 'og:video:url') ??
    extractMetaTag(html, 'og:video');
  if (streamMeta) push(streamMeta);
  if (ogVideo && !/x\.com|twitter\.com/.test(ogVideo)) push(ogVideo);

  const variantBlocks = html.match(/"variants"\s*:\s*\[[\s\S]*?\]/g);
  variantBlocks?.forEach((block) => {
    const bitrate = block.match(/"bitrate"\s*:\s*(\d+)/)?.[1];
    const urlMatches = block.match(/"url"\s*:\s*"([^"]+)"/g) ?? [];
    urlMatches.forEach((match) => {
      const url = match.match(/"url"\s*:\s*"([^"]+)"/);
      if (url?.[1]) push(url[1], bitrate ? Number(bitrate) : null);
    });
  });

  const contentTypeMatches = html.match(/"content_type"\s*:\s*"video\/mp4"[^}]{0,600}"url"\s*:\s*"([^"]+)"/g);
  contentTypeMatches?.forEach((match) => {
    const url = match.match(/"url"\s*:\s*"([^"]+)"/);
    if (url?.[1]) push(url[1]);
  });

  return results.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: string) => {
    const decoded = jsonUnescape(rawUrl).replace(/\\\//g, '/');
    const clean = htmlDecode(decoded).split('"')[0].trim();
    if (!clean.startsWith('http')) return;
    if (seen.has(clean)) return;
    if (!/\.(jpe?g|png|webp)(\?|$)|(pbs\.twimg\.com|media)/i.test(clean)) return;
    seen.add(clean);
    images.push(clean);
  };

  const ogImage =
    extractMetaTag(html, 'og:image') ??
    extractMetaTag(html, 'twitter:image') ??
    extractMetaTag(html, 'og:image:secure_url');
  if (ogImage) push(ogImage);

  const photoBlocks = html.match(/"media_url_https"\s*:\s*"([^"]+)"/g) ?? [];
  photoBlocks.forEach((match) => {
    const url = match.match(/"media_url_https"\s*:\s*"([^"]+)"/);
    if (url?.[1]) push(url[1]);
  });

  return images;
}

function parseTwitterHtml(html: string): MediaInfo | null {
  if (
    /<title>[^<]*log in to x[^<]*<\/title>/i.test(html) ||
    /not authorized|you are not allowed/i.test(html)
  ) {
    return null;
  }

  const videos = extractMp4Urls(html);
  const images = extractImages(html);

  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'X / Twitter Post';
  const description = extractMetaTag(html, 'twitter:description') ?? null;
  const thumbnail = images[0] ?? extractMetaTag(html, 'twitter:image') ?? null;

  const formats: MediaFormat[] = [];

  if (videos.length > 0) {
    const best = videos[0];
    const isHd = (best.bitrate ?? 0) >= 800_000;
    formats.push({
      id: 'x-video-best',
      kind: 'video',
      label: isHd ? 'HD MP4' : 'MP4',
      quality: isHd ? 'HD' : 'SD',
      ext: 'mp4',
      url: best.url,
      size: null,
    });
    if (videos[1]) {
      formats.push({
        id: 'x-video-alt',
        kind: 'video',
        label: 'MP4',
        quality: 'Source',
        ext: 'mp4',
        url: videos[1].url,
        size: null,
      });
    }
  }

  if (formats.length === 0 && images.length > 0) {
    images.slice(0, 4).forEach((image, index) => {
      formats.push({
        id: `x-image-${index}`,
        kind: 'image',
        label: index === 0 ? 'High Resolution JPG' : `Image ${index + 1} JPG`,
        quality: 'Original',
        ext: 'jpg',
        url: image,
        size: null,
      });
    });
  }

  if (formats.length === 0) {
    return null;
  }

  return {
    platform: 'twitter',
    title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author: description,
    formats,
  };
}

async function scrapeTwitter(canonical: string): Promise<MediaInfo | null> {
  try {
    const html = await fetchHtml(canonical, {
      referer: 'https://x.com/',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });
    return parseTwitterHtml(html);
  } catch {
    return null;
  }
}

export async function extractTwitter(rawUrl: string): Promise<MediaInfo> {
  const canonical = canonicalizeXUrl(rawUrl.trim());
  if (!/x\.com\/(?:[\w.]+\/)?status\/\d+/i.test(canonical)) {
    throw new ExtractionError('This does not look like a valid X / Twitter link.', 'INVALID_LINK');
  }

  const direct = await scrapeTwitter(canonical);
  if (direct) return direct;

  const proxiedHtml = await fetchHtmlViaProxies(canonical, {
    referer: 'https://x.com/',
  });
  if (proxiedHtml) {
    const parsed = parseTwitterHtml(proxiedHtml);
    if (parsed) return parsed;
  }

  const cobalt = await extractWithCobalt('twitter', canonical);
  if (cobalt) return cobalt;

  throw new ExtractionError(
    'We could not find downloadable media in this tweet. It may only contain text, be restricted, or X is blocking automated access from this network.',
    'X_EXTRACT_FAILED',
  );
}
