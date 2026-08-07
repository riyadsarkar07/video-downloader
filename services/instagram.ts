import type { MediaFormat, MediaInfo } from '@/lib/types';
import {
  ExtractionError,
  extractJsonLd,
  extractMetaTag,
  fetchHtml,
  htmlDecode,
  jsonUnescape,
} from '@/services/http';

function looksLikeLoginWall(html: string): boolean {
  if (/login_screen|"loginScreen"|log in to continue/i.test(html)) return true;
  if (/<title>[^<]*instagram[^<]*<\/title>/i.test(html) && !/og:video|video_versions/i.test(html)) {
    return false;
  }
  return false;
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

function extractVideoUrls(html: string): string[] {
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

  const videoVersions = html.match(/"video_versions"\s*:\s*\[[\s\S]*?\]/);
  if (videoVersions) {
    const urlMatches = videoVersions[0].match(/"url"\s*:\s*"([^"]+)"/g) ?? [];
    urlMatches.forEach((match) => {
      const url = match.match(/"url"\s*:\s*"([^"]+)"/);
      if (url?.[1]) push(url[1]);
    });
  }

  return urls;
}

function collectImages(html: string): string[] {
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

  const imageVersions = html.match(/"image_versions2"\s*:\s*\{[\s\S]*?"url"\s*:\s*"([^"]+)"/g);
  imageVersions?.forEach((match) => {
    const url = match.match(/"url"\s*:\s*"([^"]+)"/);
    if (url?.[1]) push(url[1]);
  });

  return images;
}

export async function extractInstagram(rawUrl: string): Promise<MediaInfo> {
  const candidates = buildCandidates(rawUrl);

  let lastHtml = '';
  let videos: string[] = [];
  let images: string[] = [];
  let fetchedAny = false;

  for (const candidate of candidates) {
    try {
      const html = await fetchHtml(candidate, {
        referer: 'https://www.instagram.com/',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      });
      fetchedAny = true;
      if (looksLikeLoginWall(html)) continue;
      lastHtml = html;
      const pageVideos = extractVideoUrls(html);
      const pageImages = collectImages(html);
      if (pageVideos.length > videos.length) videos = pageVideos;
      if (pageImages.length > images.length) images = pageImages;
      if (videos.length > 0) break;
    } catch {
      continue;
    }
  }

  if (!fetchedAny) {
    throw new ExtractionError(
      'Unable to reach this Instagram post. The account may be private, or Instagram is blocking automated access.',
      'IG_FETCH_FAILED',
    );
  }

  const title =
    extractMetaTag(lastHtml, 'og:title') ??
    extractMetaTag(lastHtml, 'twitter:title') ??
    'Instagram Post';
  const thumbnail =
    extractMetaTag(lastHtml, 'og:image:secure_url') ??
    extractMetaTag(lastHtml, 'og:image') ??
    images[0] ??
    null;
  const author = extractMetaTag(lastHtml, 'og:description') ?? null;

  const formats: MediaFormat[] = [];

  if (videos.length > 0) {
    const best = videos[0];
    formats.push({
      id: 'ig-video-best',
      kind: 'video',
      label: 'HD MP4',
      quality: 'Best',
      ext: 'mp4',
      url: best,
      size: null,
    });
    if (videos[1]) {
      formats.push({
        id: 'ig-video-alt',
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
        id: `ig-image-${index}`,
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
      'We could not find downloadable media on this post. It may be private or only contain text.',
      'NO_MEDIA_FOUND',
    );
  }

  return {
    platform: 'instagram',
    title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author,
    formats,
  };
}
