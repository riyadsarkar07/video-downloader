import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  extractInlineJson,
  extractJsonLd,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';

function canonicalizeThreadsUrl(rawUrl: string): string {
  return rawUrl
    .replace(/^https?:\/\/(www\.)?threads\.net/i, 'https://www.threads.net')
    .split('?')[0]
    .split('#')[0];
}

function extractVideoUrls(html: string): string[] {
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

  const videoVersions = html.match(/"video_versions"\s*:\s*\[[\s\S]*?\]/);
  if (videoVersions) {
    const urlMatches = videoVersions[0].match(/"url"\s*:\s*"([^"]+)"/g) ?? [];
    urlMatches.forEach((match) => {
      const url = match.match(/"url"\s*:\s*"([^"]+)"/);
      if (url?.[1]) push(url[1]);
    });
  }

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

function extractImages(html: string): string[] {
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

  const carousel = html.match(/"carousel_media"\s*:\s*\[[\s\S]*?\]/);
  if (carousel) {
    const urlMatches = carousel[0].match(/"url"\s*:\s*"([^"]+)"/g) ?? [];
    urlMatches.forEach((match) => {
      const url = match.match(/"url"\s*:\s*"([^"]+)"/);
      if (url?.[1]) push(url[1]);
    });
  }

  const inline = extractInlineJson(html, 'image_versions2');
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (/^https?:\/\//.test(value) && /\.(jpe?g|png|webp)(\?|$)/i.test(value)) push(value);
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
  walk(inline);

  return images;
}

export async function extractThreads(rawUrl: string): Promise<MediaInfo> {
  const canonical = canonicalizeThreadsUrl(rawUrl.trim());
  if (!/threads\.net\/@[\w.-]+\/post\/|threads\.net\/post\//i.test(canonical)) {
    throw new ExtractionError('This does not look like a valid Threads link.', 'INVALID_LINK');
  }

  let html = '';
  try {
    html = await fetchHtml(canonical, {
      referer: 'https://www.threads.net/',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      'Unable to reach this Threads post. It may be private or deleted.',
      'THREADS_FETCH_FAILED',
    );
  }

  const videos = extractVideoUrls(html);
  const images = extractImages(html);

  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Threads Post';
  const description = extractMetaTag(html, 'og:description') ?? null;
  const thumbnail = images[0] ?? null;

  const formats: MediaFormat[] = [];

  if (videos.length > 0) {
    const best = videos[0];
    formats.push({
      id: 'th-video-best',
      kind: 'video',
      label: 'HD MP4',
      quality: 'HD',
      ext: 'mp4',
      url: best,
      size: null,
    });
    if (videos[1]) {
      formats.push({
        id: 'th-video-alt',
        kind: 'video',
        label: 'MP4',
        quality: 'Source',
        ext: 'mp4',
        url: videos[1],
        size: null,
      });
    }
  }

  if (images.length > 0) {
    images.slice(0, 10).forEach((image, index) => {
      formats.push({
        id: `th-image-${index}`,
        kind: 'image',
        label: index === 0 ? 'Full Resolution JPG' : `Photo ${index + 1} JPG`,
        quality: 'Original',
        ext: 'jpg',
        url: image,
        size: null,
      });
    });
  }

  if (formats.length === 0) {
    throw new ExtractionError(
      'We could not find downloadable media in this post. It may only contain text or be restricted.',
      'NO_MEDIA_FOUND',
    );
  }

  return {
    platform: 'threads',
    title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author: description,
    formats,
  };
}
