import type { MediaFormat, MediaItem } from '@/lib/types';
import { extractInlineJson, htmlDecode, jsonUnescape } from '@/services/http';

export interface RawVersion {
  url: string;
  width: number;
  height: number;
}

interface RawMediaObject {
  media_type?: number | string;
  image_versions2?: { candidates?: Array<{ url?: string; width?: number; height?: number }> };
  video_versions?: Array<{ url?: string; width?: number; height?: number }>;
  display_url?: string;
  thumbnail_src?: string;
  original_width?: number;
  original_height?: number;
  type?: string;
}

function cleanUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const decoded = jsonUnescape(rawUrl).replace(/\\\//g, '/');
  const clean = htmlDecode(decoded).split('"')[0].trim();
  if (clean.startsWith('//')) return `https:${clean}`;
  if (!/^https?:/.test(clean)) return '';
  return clean;
}

function pickLargest(entries: Array<{ url?: string; width?: number; height?: number }>): RawVersion | null {
  let best: RawVersion | null = null;
  for (const entry of entries) {
    const url = cleanUrl(entry.url);
    if (!url) continue;
    const width = Number(entry.width ?? 0);
    const height = Number(entry.height ?? 0);
    if (!best || width * height > best.width * best.height) {
      best = { url, width, height };
    }
  }
  return best;
}

export function mediaObjectToItem(raw: unknown, index: number): MediaItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as RawMediaObject;

  const videoVersion = pickLargest(obj.video_versions ?? []);
  const imageVersion = pickLargest(obj.image_versions2?.candidates ?? []);
  const displayUrl = cleanUrl(obj.display_url);
  const thumbnailSrc = cleanUrl(obj.thumbnail_src);

  const mediaType = Number(obj.media_type ?? 0);
  const isVideo = mediaType === 2 || Boolean(videoVersion);

  const formats: MediaFormat[] = [];
  let kind: 'video' | 'image' = 'image';
  let thumbnail: string | null = imageVersion?.url ?? thumbnailSrc ?? null;

  if (isVideo && videoVersion) {
    kind = 'video';
    thumbnail = thumbnail ?? imageVersion?.url ?? thumbnailSrc ?? null;
    formats.push({
      id: `item-${index}-video`,
      kind: 'video',
      label: 'Ultra HD Video',
      quality: videoVersion.height >= 1080 ? '1080p+' : videoVersion.height >= 720 ? '720p' : 'SD',
      ext: 'mp4',
      url: videoVersion.url,
      size: null,
      width: videoVersion.width || undefined,
      height: videoVersion.height || undefined,
    });
    if (imageVersion?.url && imageVersion.url !== thumbnail) {
      formats.push({
        id: `item-${index}-cover`,
        kind: 'image',
        label: 'High-Res Photo',
        quality: 'Cover',
        ext: 'jpg',
        url: imageVersion.url,
        size: null,
        width: imageVersion.width || undefined,
        height: imageVersion.height || undefined,
      });
    }
  } else if (imageVersion?.url) {
    formats.push({
      id: `item-${index}-image`,
      kind: 'image',
      label: 'High-Res Photo',
      quality: imageVersion.height >= 1080 ? 'Ultra HD' : 'High-Res',
      ext: 'jpg',
      url: imageVersion.url,
      size: null,
      width: imageVersion.width || undefined,
      height: imageVersion.height || undefined,
    });
  } else if (displayUrl) {
    formats.push({
      id: `item-${index}-image`,
      kind: 'image',
      label: 'High-Res Photo',
      quality: 'High-Res',
      ext: 'jpg',
      url: displayUrl,
      size: null,
    });
  }

  if (formats.length === 0) return null;

  return {
    id: `item-${index}`,
    kind,
    label: `${index + 1}`,
    thumbnail,
    formats,
  };
}

export function parseCarouselMedia(html: string): MediaItem[] {
  const carousel = extractInlineJson(html, 'carousel_media');
  if (!Array.isArray(carousel)) return [];
  const items: MediaItem[] = [];
  carousel.forEach((entry, index) => {
    const item = mediaObjectToItem(entry, index);
    if (item) items.push(item);
  });
  return items;
}

export function parseSingleMedia(html: string): MediaItem | null {
  const videoVersions = extractInlineJson(html, 'video_versions');
  const imageVersions = extractInlineJson(html, 'image_versions2');

  const mediaObject: RawMediaObject = {
    media_type: videoVersions ? 2 : 1,
    video_versions: Array.isArray(videoVersions) ? (videoVersions as RawMediaObject['video_versions']) : undefined,
    image_versions2:
      typeof imageVersions === 'object' && imageVersions !== null
        ? (imageVersions as RawMediaObject['image_versions2'])
        : undefined,
  };

  const item = mediaObjectToItem(mediaObject, 0);
  if (item) return item;

  const displayUrl = cleanUrl(
    (extractInlineJson(html, 'display_url') as string | undefined) ?? undefined,
  );
  if (displayUrl) {
    return {
      id: 'item-0',
      kind: 'image',
      label: '1',
      thumbnail: displayUrl,
      formats: [
        {
          id: 'item-0-image',
          kind: 'image',
          label: 'High-Res Photo',
          quality: 'High-Res',
          ext: 'jpg',
          url: displayUrl,
          size: null,
        },
      ],
    };
  }

  return null;
}
