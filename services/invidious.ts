import type { MediaFormat, MediaInfo } from '@/lib/types';
import { ExtractionError } from '@/services/http';
import { fetchJsonViaProxies } from '@/services/fallbackEngine';

const DEFAULT_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.f5.si',
  'https://iv.datura.network',
  'https://invidious.privacyredirect.com',
  'https://invidious.flokinet.to',
  'https://yt.artemislena.eu',
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function getInstances(): string[] {
  const envList = process.env.INVIDIOUS_INSTANCES;
  if (envList && envList.trim()) {
    return envList
      .split(',')
      .map((entry) => entry.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }
  return DEFAULT_INSTANCES;
}

interface InvidiousFormat {
  itag?: number;
  url?: string;
  type?: string;
  qualityLabel?: string;
  bitrate?: number;
  contentLength?: string;
  container?: string;
}

interface InvidiousVideo {
  title?: string;
  author?: string;
  lengthSeconds?: number;
  thumbnailUrl?: string;
  formatStreams?: InvidiousFormat[];
  adaptiveFormats?: InvidiousFormat[];
}

function isAudioOnly(type: string): boolean {
  return type?.startsWith('audio/') ?? false;
}

function qualityHeight(label: string): number {
  return Number(label.match(/(\d+)/)?.[1] ?? 0);
}

function buildFormats(video: InvidiousVideo): MediaFormat[] {
  const formats: MediaFormat[] = [];

  const progressive = (video.formatStreams ?? [])
    .filter((format) => format.url && qualityHeight(format.qualityLabel ?? '') >= 144)
    .sort((a, b) => qualityHeight(b.qualityLabel ?? '') - qualityHeight(a.qualityLabel ?? ''));

  for (const [index, format] of progressive.entries()) {
    const quality = format.qualityLabel ?? '360p';
    formats.push({
      id: `inv-video-${index}`,
      kind: 'video',
      label: `${quality} MP4`,
      quality,
      ext: 'mp4',
      url: format.url as string,
      size: format.contentLength ? Number(format.contentLength) || null : null,
    });
  }

  const adaptiveVideo = (video.adaptiveFormats ?? [])
    .filter((format) => format.url && !isAudioOnly(format.type ?? '') && format.qualityLabel)
    .sort((a, b) => qualityHeight(b.qualityLabel ?? '') - qualityHeight(a.qualityLabel ?? ''));

  if (progressive.length === 0 && adaptiveVideo.length > 0) {
    const best = adaptiveVideo[0];
    const quality = best.qualityLabel ?? '720p';
    formats.push({
      id: 'inv-video-only',
      kind: 'video',
      label: `${quality} MP4 (video only)`,
      quality,
      ext: best.container === 'webm' ? 'webm' : 'mp4',
      url: best.url as string,
      size: best.contentLength ? Number(best.contentLength) || null : null,
    });
  }

  const audio = (video.adaptiveFormats ?? [])
    .filter((format) => format.url && isAudioOnly(format.type ?? ''))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

  if (audio.length > 0) {
    const best = audio[0];
    const rate = Math.round((best.bitrate ?? 128000) / 1000);
    formats.push({
      id: 'inv-audio',
      kind: 'audio',
      label: `MP3 · ${rate}kbps`,
      quality: `${rate}kbps`,
      ext: best.container === 'webm' ? 'webm' : 'mp4',
      url: best.url as string,
      size: best.contentLength ? Number(best.contentLength) || null : null,
    });
  }

  return formats;
}

const INVIDIOUS_TIMEOUT_MS = 3500;

export async function extractYouTubeWithInvidious(videoId: string): Promise<MediaInfo | null> {
  const instances = getInstances();
  let lastError: string | null = null;

  for (const instance of instances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), INVIDIOUS_TIMEOUT_MS);
      const response = await fetch(
        `${instance}/api/v1/videos/${videoId}?fields=title,author,lengthSeconds,thumbnailUrl,formatStreams,adaptiveFormats`,
        {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json',
          },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const video = (await response.json()) as InvidiousVideo;
      const built = buildInvidiousInfo(video);
      if (built) return built;
      lastError = 'no formats';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = `timeout (${INVIDIOUS_TIMEOUT_MS}ms)`;
      } else {
        lastError = error instanceof Error ? error.message : 'unknown';
      }
      continue;
    }
  }

  if (instances.length > 0) {
    const proxied = await fetchJsonViaProxies(
      `${instances[0]}/api/v1/videos/${videoId}?fields=title,author,lengthSeconds,thumbnailUrl,formatStreams,adaptiveFormats`,
      INVIDIOUS_TIMEOUT_MS,
    );
    if (proxied && typeof proxied === 'object') {
      const built = buildInvidiousInfo(proxied as InvidiousVideo);
      if (built) return built;
    }
  }

  console.warn(`Invidious fallback failed for ${videoId}: ${lastError ?? 'no instances configured'}`);
  return null;
}

function buildInvidiousInfo(video: InvidiousVideo): MediaInfo | null {
  const formats = buildFormats(video);
  if (formats.length === 0) return null;

  return {
    platform: 'youtube',
    title: video.title ?? 'YouTube Video',
    thumbnail: video.thumbnailUrl ?? null,
    duration: video.lengthSeconds ?? null,
    width: null,
    height: null,
    author: video.author ?? null,
    formats,
  };
}
