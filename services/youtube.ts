import ytdl from '@distube/ytdl-core';
import { Cookie } from 'tough-cookie';
import type { MediaFormat, MediaInfo } from '@/lib/types';
import { ExtractionError } from '@/services/http';
import { extractYouTubeWithInvidious } from '@/services/invidious';
import { extractYouTubeWithCobalt } from '@/services/cobalt';

interface NormalizedFormat {
  quality: string;
  label: string;
  url: string;
  size: number | null;
  container: 'mp4' | 'webm' | 'm4a' | 'mp3';
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function buildGetInfoOptions(): ytdl.getInfoOptions {
  const requestHeaders: Record<string, string> = {
    'user-agent': USER_AGENT,
    'accept-language': 'en-US,en;q=0.9',
  };

  const rawCookie = process.env.YOUTUBE_COOKIE;
  const options: ytdl.getInfoOptions = {
    lang: 'en',
    requestOptions: { headers: requestHeaders },
  };

  if (rawCookie && rawCookie.trim()) {
    const cookies = rawCookie
      .split(';')
      .map((cookie) => Cookie.parse(cookie.trim()))
      .filter((cookie): cookie is Cookie => cookie !== null && cookie !== undefined);
    if (cookies.length > 0) {
      options.agent = ytdl.createAgent(cookies);
    }
  }

  return options;
}

function extractVideoId(url: string): string {
  const match =
    url.match(/v=([A-Za-z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{11})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{11})/) ||
    url.match(/live\/([A-Za-z0-9_-]{11})/) ||
    url.match(/youtube\.com\/v\/([A-Za-z0-9_-]{11})/);
  if (!match) {
    throw new ExtractionError('This does not look like a valid YouTube link.', 'INVALID_LINK');
  }
  return match[1];
}

export function normalizeYouTubeUrl(rawUrl: string): string {
  const videoId = extractVideoId(rawUrl);
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function estimateSize(format: ytdl.videoFormat, durationSeconds: number | null): number | null {
  const explicit = format.contentLength;
  if (explicit && explicit !== '0') {
    const parsed = Number(explicit);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (format.bitrate && durationSeconds) {
    return Math.round((format.bitrate * durationSeconds) / 8);
  }
  return null;
}

function normalizeProgressive(
  formats: ytdl.videoFormat[],
  durationSeconds: number | null,
): NormalizedFormat[] {
  const unique = new Map<string, NormalizedFormat>();
  for (const format of formats) {
    if (!format.url) continue;
    const quality = format.qualityLabel ?? `${format.height ?? 0}p`;
    const heightMatch = quality.match(/(\d+)/);
    const height = heightMatch ? Number(heightMatch[1]) : 0;
    if (height < 144) continue;

    const container = format.container === 'webm' ? 'webm' : 'mp4';
    const size = estimateSize(format, durationSeconds);
    const existing = unique.get(height.toString());
    if (!existing || (existing.size !== null && (size === null || size > existing.size))) {
      unique.set(height.toString(), {
        quality,
        label: `${quality} MP4`,
        url: format.url,
        size,
        container,
      });
    }
  }
  return Array.from(unique.values()).sort((a, b) => {
    const aH = Number(a.quality.match(/(\d+)/)?.[1] ?? 0);
    const bH = Number(b.quality.match(/(\d+)/)?.[1] ?? 0);
    return bH - aH;
  });
}

function normalizeAudio(
  formats: ytdl.videoFormat[],
  durationSeconds: number | null,
): NormalizedFormat[] {
  const audioFormats = formats.filter((format) => format.hasAudio && !format.hasVideo);
  const best = audioFormats.reduce<ytdl.videoFormat | null>((acc, format) => {
    if (!format.url) return acc;
    if (!acc) return format;
    const accRate = acc.audioBitrate ?? 0;
    const curRate = format.audioBitrate ?? 0;
    return curRate > accRate ? format : acc;
  }, null);

  if (!best || !best.url) return [];

  const rate = best.audioBitrate ?? 128;
  const container = best.container === 'webm' ? 'webm' : 'mp4';
  return [
    {
      quality: `${rate}kbps`,
      label: `MP3 · ${rate}kbps`,
      url: best.url,
      size: estimateSize(best, durationSeconds),
      container,
    },
  ];
}

function toMediaInfo(videoId: string, info: ytdl.videoInfo): MediaInfo {
  const durationSeconds = info.videoDetails.lengthSeconds
    ? Number(info.videoDetails.lengthSeconds)
    : null;

  const progressive = normalizeProgressive(
    ytdl.filterFormats(info.formats, 'videoandaudio'),
    durationSeconds,
  );
  const audio = normalizeAudio(info.formats, durationSeconds);

  const formats: MediaFormat[] = [
    ...progressive.slice(0, 4).map((format, index) => ({
      id: `yt-video-${index}`,
      kind: 'video' as const,
      label: format.label,
      quality: format.quality,
      ext: format.container,
      url: format.url,
      size: format.size,
    })),
    ...audio.map((format, index) => ({
      id: `yt-audio-${index}`,
      kind: 'audio' as const,
      label: format.label,
      quality: format.quality,
      ext: format.container,
      url: format.url,
      size: format.size,
    })),
  ];

  if (formats.length === 0) {
    throw new ExtractionError('No downloadable formats were found for this video.', 'NO_FORMATS');
  }

  return {
    platform: 'youtube',
    title: info.videoDetails.title,
    thumbnail:
      info.videoDetails.thumbnails.sort((a, b) => b.width * b.height - a.width * a.height)[0]
        ?.url ?? info.videoDetails.thumbnails[0]?.url ?? null,
    duration: durationSeconds,
    width: null,
    height: null,
    author: info.videoDetails.author?.name ?? null,
    formats,
  };
}

export async function extractYouTube(rawUrl: string): Promise<MediaInfo> {
  const videoId = extractVideoId(rawUrl);
  const canonicalUrl = normalizeYouTubeUrl(rawUrl);

  try {
    const info = await ytdl.getInfo(canonicalUrl, buildGetInfoOptions());
    return toMediaInfo(videoId, info);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    const message = error instanceof Error ? error.message : '';

    const fallback = await tryFallbacks(canonicalUrl, videoId);
    if (fallback) return fallback;

    if (/bot|sign in to confirm|captcha|verify|403|forbidden|unavailable/i.test(message)) {
      throw new ExtractionError(
        'YouTube is currently blocking automated access from this network. Public fallback services were also unreachable. Please try again later.',
        'YT_BOT_BLOCKED',
      );
    }

    throw new ExtractionError(
      'We could not extract this video. It may be private, region-locked, or age-restricted.',
      'YT_EXTRACT_FAILED',
    );
  }
}

async function tryFallbacks(url: string, videoId: string): Promise<MediaInfo | null> {
  const invidious = await tryInvidiousFallback(videoId);
  if (invidious) return invidious;

  const cobalt = await tryCobaltFallback(url, videoId);
  if (cobalt) return cobalt;

  const invidiousAgain = await tryInvidiousFallback(videoId);
  if (invidiousAgain) return invidiousAgain;

  return null;
}

async function tryInvidiousFallback(videoId: string): Promise<MediaInfo | null> {
  try {
    return await extractYouTubeWithInvidious(videoId);
  } catch (invidiousError) {
    if (invidiousError instanceof ExtractionError) {
      console.warn(`Invidious fallback failed for ${videoId}:`, invidiousError.message);
    }
    return null;
  }
}

async function tryCobaltFallback(url: string, videoId: string): Promise<MediaInfo | null> {
  try {
    return await extractYouTubeWithCobalt(url);
  } catch (cobaltError) {
    if (cobaltError instanceof ExtractionError) {
      console.warn(`Cobalt fallback failed for ${videoId}:`, cobaltError.message);
    }
    return null;
  }
}
