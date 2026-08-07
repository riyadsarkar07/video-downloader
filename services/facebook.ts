import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  extractJsonLd,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
  resolveRedirectTarget,
} from '@/services/http';

const VIDEO_PATTERNS: Array<{ key: string; quality: string; label: string }> = [
  { key: 'browser_native_hd_url', quality: 'HD', label: 'HD MP4' },
  { key: 'hd_src', quality: 'HD', label: 'HD MP4' },
  { key: 'playable_url_quality_hd', quality: 'HD', label: 'HD MP4' },
  { key: 'sd_src', quality: 'SD', label: 'SD MP4' },
  { key: 'browser_native_sd_url', quality: 'SD', label: 'SD MP4' },
  { key: 'playable_url', quality: 'SD', label: 'SD MP4' },
];

function canonicalizeFacebookUrl(rawUrl: string): string {
  return rawUrl
    .replace(/^https?:\/\/(www\.|m\.|web\.|touch\.|mbasic\.)?facebook\.com/i, 'https://www.facebook.com')
    .replace(/^https?:\/\/fb\.watch\//i, 'https://www.facebook.com/')
    .split('#')[0];
}

async function resolveShareLink(rawUrl: string): Promise<string | null> {
  const target = await resolveRedirectTarget(rawUrl);
  if (!target || target === rawUrl) return null;
  const clean = target.split('#')[0];
  if (!/facebook\.com\/(?:watch|reel|videos?|photo)/i.test(clean)) return null;
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

interface PageResult {
  html: string;
  videos: Array<{ url: string; quality: string; label: string }>;
  fetched: boolean;
}

async function tryFetchCandidate(candidate: string): Promise<PageResult> {
  try {
    const html = await fetchHtml(candidate, {
      referer: 'https://www.facebook.com/',
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    });
    if (looksLikeLoginWall(html)) {
      return { html: '', videos: [], fetched: true };
    }
    const videos = dedupeAndSort(extractVideoUrls(html));
    const ldVideos = collectJsonLdVideoUrls(html);
    const fallback = extractFallbackVideo(html);
    const resultVideos = [...videos];
    const seen = new Set(resultVideos.map((video) => video.url));
    for (const ldUrl of ldVideos) {
      if (!seen.has(ldUrl)) {
        seen.add(ldUrl);
        resultVideos.push({ url: ldUrl, quality: 'SD', label: 'SD MP4' });
      }
    }
    if (fallback && !seen.has(fallback)) {
      resultVideos.push({ url: fallback, quality: 'SD', label: 'SD MP4' });
    }
    return { html, videos: resultVideos, fetched: true };
  } catch {
    return { html: '', videos: [], fetched: false };
  }
}

function extractTitleAndThumbnail(html: string): { title: string; thumbnail: string | null } {
  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Facebook Video';
  const thumbnail =
    extractMetaTag(html, 'og:image') ?? extractMetaTag(html, 'twitter:image') ?? null;
  return { title, thumbnail };
}

export async function extractFacebook(rawUrl: string): Promise<MediaInfo> {
  const trimmed = rawUrl.trim();
  if (!/facebook\.com|fb\.watch/i.test(trimmed)) {
    throw new ExtractionError('This does not look like a valid Facebook link.', 'INVALID_LINK');
  }

  const candidates = await buildCandidates(trimmed);
  let lastHtml = '';
  let fetchedAny = false;
  let bestVideos: Array<{ url: string; quality: string; label: string }> = [];

  for (const candidate of candidates) {
    const result = await tryFetchCandidate(candidate);
    if (result.fetched) fetchedAny = true;
    if (result.html) lastHtml = result.html;
    if (result.videos.length > bestVideos.length) {
      bestVideos = result.videos;
      lastHtml = result.html;
    }
    if (bestVideos.length > 0 && bestVideos.some((video) => video.quality === 'HD')) break;
  }

  if (bestVideos.length === 0) {
    if (!fetchedAny) {
      throw new ExtractionError(
        'Unable to reach this Facebook post. Facebook may be blocking automated access; please try again later.',
        'FB_FETCH_FAILED',
      );
    }
    throw new ExtractionError(
      'We could not find a downloadable video on this page. The post may be private, or it may only contain photos.',
      'NO_VIDEO_FOUND',
    );
  }

  const { title, thumbnail } = extractTitleAndThumbnail(lastHtml);

  const formats: MediaFormat[] = bestVideos.map((video, index) => ({
    id: `fb-${index}`,
    kind: 'video',
    label: video.label,
    quality: video.quality,
    ext: 'mp4',
    url: video.url,
    size: null,
  }));

  return {
    platform: 'facebook',
    title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author: null,
    formats,
  };
}
