import type { MediaFormat, MediaInfo, MediaItem } from '@/lib/types';
import {
  ExtractionError,
  extractJsonLd,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
  resolveRedirectTarget,
} from '@/services/http';
import { extractWithCobalt, fetchHtmlViaProxies } from '@/services/fallbackEngine';
import { stripTrackingParams } from '@/lib/platforms';

const VIDEO_PATTERNS: Array<{ key: string; quality: string; label: string }> = [
  { key: 'browser_native_hd_url', quality: 'HD', label: 'HD MP4' },
  { key: 'hd_src', quality: 'HD', label: 'HD MP4' },
  { key: 'playable_url_quality_hd', quality: 'HD', label: 'HD MP4' },
  { key: 'sd_src', quality: 'SD', label: 'SD MP4' },
  { key: 'browser_native_sd_url', quality: 'SD', label: 'SD MP4' },
  { key: 'playable_url', quality: 'SD', label: 'SD MP4' },
];

function canonicalizeFacebookUrl(rawUrl: string): string {
  return stripTrackingParams(
    rawUrl
      .replace(/^https?:\/\/(www\.|m\.|web\.|touch\.|mbasic\.)?facebook\.com/i, 'https://www.facebook.com')
      .replace(/^https?:\/\/fb\.watch\//i, 'https://www.facebook.com/')
      .split('#')[0],
  );
}

async function resolveShareLink(rawUrl: string): Promise<string | null> {
  const target = await resolveRedirectTarget(rawUrl, 10000);
  if (!target || target === rawUrl) return null;
  const clean = target.split('#')[0];
  if (!/facebook\.com\/(?:watch|reel|videos?|video\.php|photo|story\.php|groups\/)/i.test(clean)) {
    return null;
  }
  return clean;
}

async function buildCandidates(rawUrl: string): Promise<string[]> {
  const desktop = canonicalizeFacebookUrl(rawUrl.trim());
  const candidates: string[] = [desktop];

  const resolved = await resolveShareLink(desktop);
  if (resolved && resolved !== desktop) {
    candidates.unshift(resolved);
  }

  const withoutQuery = desktop.split('?')[0];
  if (withoutQuery !== desktop && withoutQuery.length > 0) {
    candidates.push(withoutQuery);
  }

  const mobile = desktop.replace('https://www.facebook.com', 'https://m.facebook.com');
  candidates.push(mobile);

  candidates.push(
    `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      desktop,
    )}&show_text=false&mime_type=video%2Fmp4`,
  );

  return Array.from(new Set(candidates));
}

function looksLikeLoginWall(html: string): boolean {
  if (/<title>[^<]*log in to facebook[^<]*<\/title>/i.test(html)) return true;
  if (/log in to use your facebook account/i.test(html)) return true;
  if (/you must log in to continue/i.test(html)) return true;
  if (/id="login_form"/i.test(html)) return true;
  return false;
}

function extractVideoUrls(
  html: string,
): Map<string, { url: string; quality: string; label: string }> {
  const found = new Map<string, { url: string; quality: string; label: string }>();

  for (const { key, quality, label } of VIDEO_PATTERNS) {
    const matchers = [
      new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'g'),
      new RegExp(`${key}["']?\\s*:\\s*["']([^"']+)["']`, 'g'),
      new RegExp(`"${key}"\\s*:\\s*["']([^"']+)["']`, 'g'),
    ];
    for (const matcher of matchers) {
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(html)) !== null) {
        const raw = match[1];
        if (!raw || !raw.includes('http')) continue;
        const decoded = jsonUnescape(raw).replace(/\\\//g, '/');
        const clean = htmlDecode(decoded).split('"')[0];
        if (!clean.startsWith('http')) continue;
        if (!found.has(clean)) {
          found.set(clean, { url: clean, quality, label });
        }
      }
    }
  }

  return found;
}

function extractPhotoUrls(html: string): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();

  const push = (rawUrl: string) => {
    const decoded = jsonUnescape(rawUrl).replace(/\\\//g, '/');
    const clean = htmlDecode(decoded).split('"')[0].trim();
    if (!clean.startsWith('https://')) return;
    if (!/(scontent|fbcdn|cdninstagram)/i.test(clean)) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    photos.push(clean);
  };

  const patterns = [
    /"image"\s*:\s*"((?:https?:)?\\?\/\\?\/scontent[^"]+)"/g,
    /"uri"\s*:\s*"((?:https?:)?\\?\/\\?\/[^"]*scontent[^"]+)"/g,
    /"image_uri"\s*:\s*"((?:https?:)?\\?\/\\?\/[^"]+)"/g,
    /"image_url"\s*:\s*"((?:https?:)?\\?\/\\?\/[^"]+)"/g,
    /"src"\s*:\s*"((?:https?:)?\\?\/\\?\/scontent[^"]+)"/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const raw = match[1];
      if (!raw) continue;
      const resolved = raw.startsWith('//') ? `https:${raw}` : raw;
      push(resolved);
    }
  }

  const ogImage =
    extractMetaTag(html, 'og:image:secure_url') ??
    extractMetaTag(html, 'og:image') ??
    extractMetaTag(html, 'twitter:image');
  if (ogImage) push(ogImage);

  return photos;
}

function collectJsonLdVideoUrls(html: string): string[] {
  const urls: string[] = [];
  const ld = extractJsonLd(html);
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (value.startsWith('https://') && /\.(mp4|m4v|mov|webm)(\?|$)/i.test(value)) {
        urls.push(value);
      }
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

function extractFallbackVideo(html: string): string | null {
  const ogVideo =
    extractMetaTag(html, 'og:video:secure_url') ?? extractMetaTag(html, 'og:video');
  if (ogVideo && ogVideo.startsWith('http') && /\.(mp4|mov|webm)/i.test(ogVideo)) {
    return ogVideo;
  }
  const blobMatch = html.match(
    /"(?:https:)?\/\/video[^"]*?\.facebook\.com[^"]*?(?:mp4|m4v)[^"]*"/i,
  );
  if (blobMatch) {
    const candidate = blobMatch[0].replace(/^"|"$/g, '').replace(/\\\//g, '/');
    if (candidate.startsWith('http')) return candidate;
    if (candidate.startsWith('//')) return `https:${candidate}`;
  }
  return null;
}

function dedupeAndSort(
  candidates: Map<string, { url: string; quality: string; label: string }>,
): Array<{ url: string; quality: string; label: string }> {
  const order: Record<string, number> = { HD: 0, SD: 1 };
  return Array.from(candidates.values()).sort(
    (a, b) => (order[a.quality] ?? 9) - (order[b.quality] ?? 9),
  );
}

interface PageContent {
  videos: Array<{ url: string; quality: string; label: string }>;
  photos: string[];
  title: string;
  thumbnail: string | null;
  fetched: boolean;
}

async function parseFacebookHtml(html: string): Promise<PageContent> {
  if (looksLikeLoginWall(html)) {
    return { videos: [], photos: [], title: 'Facebook Post', thumbnail: null, fetched: true };
  }

  const videos = dedupeAndSort(extractVideoUrls(html));
  const ldVideos = collectJsonLdVideoUrls(html);
  const fallbackVideo = extractFallbackVideo(html);
  const seen = new Set(videos.map((video) => video.url));
  for (const ldUrl of ldVideos) {
    if (!seen.has(ldUrl)) {
      seen.add(ldUrl);
      videos.push({ url: ldUrl, quality: 'SD', label: 'SD MP4' });
    }
  }
  if (fallbackVideo && !seen.has(fallbackVideo)) {
    videos.push({ url: fallbackVideo, quality: 'SD', label: 'SD MP4' });
  }

  const photos = extractPhotoUrls(html);
  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Facebook Post';
  const thumbnail = photos[0] ?? extractMetaTag(html, 'og:image') ?? null;

  return { videos, photos, title, thumbnail, fetched: true };
}

interface FacebookPayload {
  title: string;
  thumbnail: string | null;
  videos: Array<{ url: string; quality: string; label: string }>;
  photos: string[];
}

function buildFacebookMediaInfo(payload: FacebookPayload): MediaInfo | null {
  const { title, thumbnail, videos, photos } = payload;
  const items: MediaItem[] = [];
  const formats: MediaFormat[] = [];

  if (videos.length > 0) {
    const videoFormats: MediaFormat[] = videos.map((video, index) => ({
      id: `fb-video-${index}`,
      kind: 'video',
      label: video.label,
      quality: video.quality,
      ext: 'mp4',
      url: video.url,
      size: null,
    }));
    formats.push(...videoFormats);
    items.push({
      id: 'item-video',
      kind: 'video',
      label: 'Video',
      thumbnail,
      formats: videoFormats,
    });
  }

  if (photos.length > 0) {
    photos.slice(0, 10).forEach((photo, index) => {
      const photoFormat: MediaFormat = {
        id: `fb-photo-${index}`,
        kind: 'image',
        label: index === 0 ? 'High-Res Photo' : `Photo ${index + 1}`,
        quality: 'High-Res',
        ext: 'jpg',
        url: photo,
        size: null,
      };
      formats.push(photoFormat);
      items.push({
        id: `item-photo-${index}`,
        kind: 'image',
        label: `${index + 1}`,
        thumbnail: photo,
        formats: [photoFormat],
      });
    });
  }

  if (formats.length === 0) return null;

  return {
    platform: 'facebook',
    title,
    thumbnail: thumbnail ?? items[0]?.thumbnail ?? null,
    duration: null,
    width: null,
    height: null,
    author: null,
    formats,
    items,
  };
}

export async function extractFacebook(rawUrl: string): Promise<MediaInfo> {
  const trimmed = rawUrl.trim();
  if (!/facebook\.com|fb\.watch/i.test(trimmed)) {
    throw new ExtractionError('This does not look like a valid Facebook link.', 'INVALID_LINK');
  }

  const candidates = await buildCandidates(trimmed);
  let fetchedAny = false;
  let bestPayload: FacebookPayload | null = null;

  for (const candidate of candidates) {
    try {
      const html = await fetchHtml(candidate, {
        referer: 'https://www.facebook.com/',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      });
      const content = await parseFacebookHtml(html);
      if (content.fetched) fetchedAny = true;
      const candidatePayload: FacebookPayload = {
        title: content.title,
        thumbnail: content.thumbnail,
        videos: content.videos,
        photos: content.photos,
      };
      const built = buildFacebookMediaInfo(candidatePayload);
      if (built && (!bestPayload || built.formats.length > 0)) {
        bestPayload = candidatePayload;
      }
      if (bestPayload && bestPayload.videos.length > 0 && bestPayload.videos.some((video) => video.quality === 'HD')) {
        break;
      }
    } catch {
      continue;
    }
  }

  if (bestPayload) {
    const built = buildFacebookMediaInfo(bestPayload);
    if (built) return built;
  }

  const proxiedHtml = await fetchHtmlViaProxies(candidates[0], {
    referer: 'https://www.facebook.com/',
  });
  if (proxiedHtml) {
    const content = await parseFacebookHtml(proxiedHtml);
    const built = buildFacebookMediaInfo({
      title: content.title,
      thumbnail: content.thumbnail,
      videos: content.videos,
      photos: content.photos,
    });
    if (built) return built;
  }

  const cobalt = await extractWithCobalt('facebook', candidates[0]);
  if (cobalt) return cobalt;

  if (!fetchedAny) {
    throw new ExtractionError(
      'Unable to reach this Facebook post. Facebook may be blocking automated access; please try again later.',
      'FB_FETCH_FAILED',
    );
  }
  throw new ExtractionError(
    'We could not find any downloadable video or photo on this page. The post may be private or deleted.',
    'NO_MEDIA_FOUND',
  );
}
