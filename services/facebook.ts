import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';

const VIDEO_PATTERNS: Array<{ key: string; quality: string; label: string }> = [
  { key: 'browser_native_hd_url', quality: 'HD', label: 'HD MP4' },
  { key: 'hd_src', quality: 'HD', label: 'HD MP4' },
  { key: 'playable_url_quality_hd', quality: 'HD', label: 'HD MP4' },
  { key: 'sd_src', quality: 'SD', label: 'SD MP4' },
  { key: 'browser_native_sd_url', quality: 'SD', label: 'SD MP4' },
  { key: 'playable_url', quality: 'SD', label: 'SD MP4' },
];

function normalizeFacebookUrl(rawUrl: string): string {
  return rawUrl
    .replace(/^https?:\/\/(www\.)?(m\.|web\.|touch\.)?facebook\.com/i, 'https://www.facebook.com')
    .replace(/^https?:\/\/fb\.watch\//i, 'https://www.facebook.com/');
}

function extractVideoUrls(html: string): Map<string, { url: string; quality: string; label: string }> {
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
        if (!raw || !raw.includes('https://')) continue;
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

function extractFallbackVideo(html: string): string | null {
  const ogVideo = extractMetaTag(html, 'og:video:secure_url') ?? extractMetaTag(html, 'og:video');
  if (ogVideo && ogVideo.startsWith('http') && /\.(mp4|mov|webm)/i.test(ogVideo)) {
    return ogVideo;
  }
  const blobMatch = html.match(/"(?:https:)?\/\/video[^"]*?\.facebook\.com[^"]*?(?:mp4|m4v)[^"]*"/i);
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

export async function extractFacebook(rawUrl: string): Promise<MediaInfo> {
  const normalized = normalizeFacebookUrl(rawUrl.trim());
  if (!/facebook\.com|fb\.watch/i.test(normalized)) {
    throw new ExtractionError('This does not look like a valid Facebook link.', 'INVALID_LINK');
  }

  let html = '';
  try {
    html = await fetchHtml(normalized);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('Unable to reach this Facebook post.', 'FB_FETCH_FAILED');
  }

  const videos = dedupeAndSort(extractVideoUrls(html));
  const fallback = videos.length === 0 ? extractFallbackVideo(html) : null;
  if (fallback) {
    videos.push({ url: fallback, quality: 'SD', label: 'SD MP4' });
  }

  if (videos.length === 0) {
    throw new ExtractionError(
      'We could not find a downloadable video on this page. The post may be private, or it may only contain photos.',
      'NO_VIDEO_FOUND',
    );
  }

  const title =
    extractMetaTag(html, 'og:title') ??
    extractMetaTag(html, 'twitter:title') ??
    'Facebook Video';
  const thumbnail =
    extractMetaTag(html, 'og:image') ?? extractMetaTag(html, 'twitter:image') ?? null;

  const formats: MediaFormat[] = videos.map((video, index) => ({
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
