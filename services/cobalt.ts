import type { MediaFormat, MediaInfo } from '@/lib/types';
import { ExtractionError } from '@/services/http';

const COBALT_API =
  process.env.COBALT_API_URL?.trim() || 'https://api.cobalt.tools/api/json';
const COBALT_API_KEY = process.env.COBALT_API_KEY?.trim() || '';
const COBALT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface CobaltErrorResponse {
  status: 'error' | 'rate-limit' | 'invalid' | 'client-error';
  text?: string;
}

interface CobaltPickerEntry {
  url?: string;
  type?: string;
  thumb?: string;
}

interface CobaltSuccessResponse {
  status: 'success' | 'tunnel' | 'redirect' | 'stream';
  url?: string;
  text?: string;
}

interface CobaltPickerResponse {
  status: 'picker';
  picker?: CobaltPickerEntry[];
}

type CobaltResponse = CobaltSuccessResponse | CobaltPickerResponse | CobaltErrorResponse;

interface CobaltRequestOptions {
  url: string;
  downloadMode?: 'auto' | 'audio' | 'mute';
  videoQuality?: 'max' | '1080' | '720' | '480' | '360' | '2160' | '1440';
  audioFormat?: 'mp3' | 'wav' | 'opus' | 'best' | 'm4a' | 'ogg' | 'acc';
  audioBitrate?: 128 | 320 | 'auto';
}

async function cobaltPost(options: CobaltRequestOptions): Promise<CobaltResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': COBALT_UA,
    };
    if (COBALT_API_KEY) {
      headers['Authorization'] = `Bearer ${COBALT_API_KEY}`;
    }
    const response = await fetch(COBALT_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: options.url,
        downloadMode: options.downloadMode ?? 'auto',
        videoQuality: options.videoQuality ?? '1080',
        audioFormat: options.audioFormat ?? 'mp3',
        audioBitrate: options.audioBitrate ?? 'auto',
        filenameStyle: 'pretty',
        disableMetadata: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ExtractionError(`Cobalt API returned HTTP ${response.status}.`, 'COBALT_HTTP');
    }
    const data = (await response.json()) as CobaltResponse;
    if (typeof data !== 'object' || data === null || !('status' in data)) {
      throw new ExtractionError('Cobalt API returned an unexpected response.', 'COBALT_BAD_PAYLOAD');
    }
    return data;
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('Cobalt API could not be reached.', 'COBALT_NETWORK');
  } finally {
    clearTimeout(timeout);
  }
}

function extractUsableUrl(response: CobaltResponse): string | null {
  if (
    response.status === 'success' ||
    response.status === 'tunnel' ||
    response.status === 'redirect' ||
    response.status === 'stream'
  ) {
    return response.url ?? null;
  }
  if (response.status === 'picker' && Array.isArray(response.picker)) {
    const videoEntry = response.picker.find((entry) => entry.url && entry.type?.includes('video'));
    const anyEntry = response.picker.find((entry) => entry.url);
    return videoEntry?.url ?? anyEntry?.url ?? null;
  }
  return null;
}

function youtubeVideoIdFromUrl(url: string): string | null {
  const match =
    url.match(/v=([A-Za-z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{11})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{11})/) ||
    url.match(/live\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function fetchYoutubeOembed(url: string): Promise<{ title: string; author: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      {
        headers: { 'User-Agent': COBALT_UA },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!response.ok) return { title: 'YouTube Video', author: null };
    const data = (await response.json()) as { title?: string; author_name?: string };
    return {
      title: data.title ?? 'YouTube Video',
      author: data.author_name ?? null,
    };
  } catch {
    return { title: 'YouTube Video', author: null };
  }
}

export async function extractYouTubeWithCobalt(url: string): Promise<MediaInfo> {
  const videoId = youtubeVideoIdFromUrl(url);
  const thumbnail = videoId
    ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
    : null;

  const videoResponse = await cobaltPost({ url, downloadMode: 'auto', videoQuality: '1080' });
  const videoUrl = extractUsableUrl(videoResponse);
  if (!videoUrl) {
    const text =
      videoResponse.status === 'rate-limit'
        ? 'Cobalt API rate limit reached. Please try again shortly.'
        : videoResponse.status === 'error'
          ? (videoResponse.text ?? 'Cobalt could not download this video.')
          : 'Cobalt could not extract this video.';
    throw new ExtractionError(
      `${text} You can set COBALT_API_URL to a working Cobalt instance to enable this fallback.`,
      'COBALT_FAILED',
    );
  }

  const formats: MediaFormat[] = [
    {
      id: 'cobalt-video',
      kind: 'video',
      label: '1080p MP4',
      quality: '1080p',
      ext: 'mp4',
      url: videoUrl,
      size: null,
    },
  ];

  let audioResponse: CobaltResponse | null = null;
  try {
    audioResponse = await cobaltPost({
      url,
      downloadMode: 'audio',
      audioFormat: 'mp3',
      audioBitrate: 128,
    });
  } catch {
    audioResponse = null;
  }
  const audioUrl = audioResponse ? extractUsableUrl(audioResponse) : null;
  if (audioUrl) {
    formats.push({
      id: 'cobalt-audio',
      kind: 'audio',
      label: 'MP3 · 128kbps',
      quality: '128kbps',
      ext: 'mp3',
      url: audioUrl,
      size: null,
    });
  }

  const oembed = await fetchYoutubeOembed(url);

  return {
    platform: 'youtube',
    title: oembed.title,
    thumbnail,
    duration: null,
    width: null,
    height: null,
    author: oembed.author,
    formats,
  };
}
