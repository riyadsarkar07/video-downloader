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

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const ACCEPT_HTML =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';

interface GraphNode {
  __typename?: string;
  video_url?: string;
  display_url?: string;
}

interface GraphShortcodeMedia extends GraphNode {
  edge_sidecar_to_children?: { edges?: Array<{ node?: GraphNode }> };
}

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

function extractShortcode(url: string): string | null {
  const match = url.match(
    /instagram\.com\/(?:reel|p|tv|reels|stories)\/([A-Za-z0-9_-]+)/i,
  );
  return match?.[1] ?? null;
}

function graphQlMediaItem(node: GraphNode | undefined, index: number): MediaItem | null {
  if (!node) return null;
  const isVideo = node.__typename === 'GraphVideo' || Boolean(node.video_url);
  const imageUrl = node.display_url ? htmlDecode(node.display_url) : null;
  const videoUrl = node.video_url ? htmlDecode(node.video_url) : null;

  const formats: MediaFormat[] = [];
  let kind: 'video' | 'image' = 'image';
  let thumbnail: string | null = imageUrl;

  if (isVideo && videoUrl) {
    kind = 'video';
    formats.push({
      id: `ig-gql-video-${index}`,
      kind: 'video',
      label: 'Ultra HD Video',
      quality: 'HD',
      ext: 'mp4',
      url: videoUrl,
      size: null,
    });
    if (imageUrl && imageUrl !== videoUrl) {
      formats.push({
        id: `ig-gql-cover-${index}`,
        kind: 'image',
        label: 'High-Res Photo',
        quality: 'Cover',
        ext: 'jpg',
        url: imageUrl,
        size: null,
      });
    }
  } else if (imageUrl) {
    formats.push({
      id: `ig-gql-image-${index}`,
      kind: 'image',
      label: 'High-Res Photo',
      quality: 'High-Res',
      ext: 'jpg',
      url: imageUrl,
      size: null,
    });
  }

  if (formats.length === 0) return null;

  return {
    id: `gql-item-${index}`,
    kind,
    label: `${index + 1}`,
    thumbnail,
    formats,
  };
}

async function fetchInstagramGraphQl(shortcode: string): Promise<MediaInfo | null> {
  const endpoint = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
  for (const ua of [MOBILE_UA, 'instagram-web']) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(endpoint, {
        headers: {
          'user-agent': ua,
          'accept-language': 'en-US,en;q=0.9',
          accept: 'application/json,text/html,*/*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const json = (await response.json()) as {
        graphql?: { shortcode_media?: GraphShortcodeMedia };
      };
      const media = json?.graphql?.shortcode_media;
      if (!media) continue;

      const nodes: Array<GraphNode | undefined> = [];
      if (
        media.__typename === 'GraphSidecar' &&
        Array.isArray(media.edge_sidecar_to_children?.edges)
      ) {
        media.edge_sidecar_to_children.edges.forEach((edge) => nodes.push(edge.node));
      } else {
        nodes.push(media as GraphNode);
      }

      const items: MediaItem[] = [];
      nodes.forEach((node, index) => {
        const item = graphQlMediaItem(node, index);
        if (item) items.push(item);
      });
      if (items.length === 0) continue;

      const thumbnail = items[0].thumbnail ?? null;
      return {
        platform: 'instagram',
        title: 'Instagram Post',
        thumbnail,
        duration: null,
        width: null,
        height: null,
        author: null,
        formats: items.flatMap((item) => item.formats),
        items,
      };
    } catch {
      continue;
    }
  }
  return null;
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

  for (const ua of [MOBILE_UA, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36']) {
    for (const candidate of candidates) {
      try {
        const html = await fetchHtml(candidate, {
          referer: 'https://www.instagram.com/',
          'user-agent': ua,
          accept: ACCEPT_HTML,
        });
        const parsed = parseInstagramHtml(html);
        if (parsed) {
          lastInfo = parsed;
          if (parsed.items && parsed.items.length > 1) return lastInfo;
        }
      } catch {
        continue;
      }
    }
    if (lastInfo) return lastInfo;
  }

  return lastInfo;
}

export async function extractInstagram(rawUrl: string): Promise<MediaInfo> {
  const canonical = canonicalizeInstagramUrl(rawUrl.trim());
  const shortcode = extractShortcode(rawUrl) ?? extractShortcode(canonical);

  const direct = await scrapeInstagram(rawUrl);
  if (direct) return direct;

  if (shortcode) {
    const graphQl = await fetchInstagramGraphQl(shortcode);
    if (graphQl) return graphQl;
  }

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
