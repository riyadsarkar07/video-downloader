import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  deepSearch,
  extractInlineJson,
  extractMetaTag,
  extractScriptJson,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';

function cleanTikTokUrl(rawUrl: string): string {
  const decoded = jsonUnescape(rawUrl).replace(/\\\//g, '/');
  const clean = htmlDecode(decoded).split('"')[0].trim();
  if (clean.startsWith('//')) return `https:${clean}`;
  if (!clean.startsWith('http')) return '';
  if (clean.includes('/playwm/')) return clean.replace(/\/playwm\//, '/play/');
  return clean;
}

function pickBestVideoUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return cleanTikTokUrl(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = pickBestVideoUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const urlList = record.urlList ?? record.url_list ?? record.src;
    const candidates = Array.isArray(urlList)
      ? urlList
      : urlList
        ? [urlList]
        : [];
    if (candidates.length > 0) {
      for (const candidate of candidates) {
        const url = typeof candidate === 'string' ? cleanTikTokUrl(candidate) : '';
        if (url) return url;
      }
    }
    for (const nested of Object.values(record)) {
      const url = pickBestVideoUrl(nested);
      if (url) return url;
    }
  }
  return null;
}

function extractFirstImageUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return cleanTikTokUrl(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractFirstImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const urlList = record.urlList ?? record.url_list;
    if (Array.isArray(urlList) && urlList.length > 0) {
      const url = cleanTikTokUrl(urlList[0] as string);
      if (url) return url;
    }
    for (const nested of Object.values(record)) {
      const url = extractFirstImageUrl(nested);
      if (url) return url;
    }
  }
  return null;
}

function extractVideoUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (url: string) => {
    const clean = cleanTikTokUrl(url);
    if (!clean) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    urls.push(clean);
  };

  const playAddr = html.match(/"playAddr"\s*:\s*("(?:https?:)?[^"]+"|\{[\s\S]*?\})/);
  if (playAddr?.[1]) {
    const raw = playAddr[1];
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        const url = pickBestVideoUrl(parsed);
        if (url) push(url);
      } catch {
        const inner = raw.match(/"url"\s*:\s*"([^"]+)"/);
        if (inner?.[1]) push(inner[1]);
      }
    } else {
      const url = raw.replace(/^"|"$/g, '');
      if (url) push(url);
    }
  }

  const downloadAddr = html.match(/"downloadAddr"\s*:\s*"(?:https?:)?[^"]+"/);
  if (downloadAddr) {
    const url = downloadAddr[0].match(/"(https?:)?[^"]+"/)?.[0]?.replace(/^"|"$/g, '');
    if (url) push(url);
  }

  const ogVideo =
    extractMetaTag(html, 'og:video:url') ??
    extractMetaTag(html, 'og:video') ??
    extractMetaTag(html, 'twitter:player:stream');
  if (ogVideo) push(ogVideo);

  return urls;
}

export async function extractTikTok(rawUrl: string): Promise<MediaInfo> {
  const trimmed = rawUrl.trim();
  if (
    !/tiktok\.com\/(@[\w.-]+\/(video|photo)\/|video\/|t\/)|(vt|vm)\.tiktok\.com\//i.test(trimmed)
  ) {
    throw new ExtractionError('This does not look like a valid TikTok link.', 'INVALID_LINK');
  }

  let html = '';
  try {
    html = await fetchHtml(trimmed, {
      referer: 'https://www.tiktok.com/',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError(
      'Unable to reach this TikTok video. It may be private or deleted.',
      'TT_FETCH_FAILED',
    );
  }

  const universalData = extractScriptJson(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__');
  const fallbackData = extractInlineJson(html, '__UNIVERSAL_DATA_FOR_REHYDRATION__');

  const itemStruct =
    deepSearch(universalData, ['itemStruct']) ??
    deepSearch(universalData, ['itemInfo']) ??
    deepSearch(fallbackData, ['itemStruct']) ??
    deepSearch(fallbackData, ['itemInfo']) ??
    null;

  const videoData = deepSearch(itemStruct, ['video']) as
    | Record<string, unknown>
    | undefined;
  const imagePost = deepSearch(itemStruct, ['imagePost']) as
    | Record<string, unknown>
    | undefined;

  const playAddr = videoData ? (videoData.playAddr ?? null) : null;
  const downloadAddr = videoData ? videoData.downloadAddr : null;

  const videoUrls =
    extractVideoUrlsFromHtml(html);
  const jsonVideoUrl =
    pickBestVideoUrl(downloadAddr) ?? pickBestVideoUrl(playAddr) ?? null;
  if (jsonVideoUrl && !videoUrls.includes(jsonVideoUrl)) {
    videoUrls.unshift(jsonVideoUrl);
  }

  const cover =
    videoData
      ? extractFirstImageUrl((videoData.cover as { urlList?: unknown })?.urlList) ??
        extractFirstImageUrl(videoData.cover)
      : null;

  const title =
    (typeof deepSearch(itemStruct, ['desc']) === 'string'
      ? (deepSearch(itemStruct, ['desc']) as string)
      : null) ??
    extractMetaTag(html, 'og:title') ??
    'TikTok Video';

  const author =
    (deepSearch(itemStruct, ['uniqueId']) as string | undefined) ??
    (deepSearch(itemStruct, ['author']) === 'string'
      ? (deepSearch(itemStruct, ['author']) as string)
      : null) ??
    null;

  const durationMs =
    typeof videoData?.duration === 'number'
      ? (videoData.duration as number)
      : typeof videoData?.duration === 'string'
        ? Number(videoData.duration)
        : 0;
  const duration = durationMs > 0 ? durationMs / 1000 : null;

  const formats: MediaFormat[] = [];

  if (videoUrls.length > 0) {
    const best = videoUrls[0];
    formats.push({
      id: 'tt-video-nw',
      kind: 'video',
      label: 'No Watermark MP4',
      quality: 'HD',
      ext: 'mp4',
      url: best,
      size: null,
    });
    if (videoUrls[1]) {
      formats.push({
        id: 'tt-video-alt',
        kind: 'video',
        label: 'MP4',
        quality: 'Source',
        ext: 'mp4',
        url: videoUrls[1],
        size: null,
      });
    }
  }

  if (imagePost && typeof imagePost === 'object') {
    const images = deepSearch(imagePost, ['images']);
    if (Array.isArray(images)) {
      const imageUrls: string[] = [];
      for (const image of images) {
        const url =
          (typeof image === 'object' &&
            extractFirstImageUrl((image as Record<string, unknown>).imageURL)) ??
          extractFirstImageUrl(image);
        if (url) imageUrls.push(url);
      }
      if (imageUrls.length === 0 && cover) imageUrls.push(cover);
      imageUrls.slice(0, 10).forEach((url, index) => {
        formats.push({
          id: `tt-image-${index}`,
          kind: 'image',
          label: index === 0 ? 'Full Resolution JPG' : `Photo ${index + 1} JPG`,
          quality: 'Original',
          ext: 'jpg',
          url,
          size: null,
        });
      });
    }
  }

  const ogImage = extractMetaTag(html, 'og:image');
  const thumbnail = cover ?? ogImage ?? null;

  if (formats.length === 0) {
    throw new ExtractionError(
      'We could not find a downloadable video on this TikTok page. It may be private or restricted.',
      'NO_MEDIA_FOUND',
    );
  }

  return {
    platform: 'tiktok',
    title,
    thumbnail,
    duration,
    width: null,
    height: null,
    author,
    formats,
  };
}
