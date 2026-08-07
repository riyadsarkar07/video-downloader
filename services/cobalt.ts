import type { MediaFormat, MediaInfo } from '@/lib/types';
import { ExtractionError } from '@/services/http';
import { fetchCobaltResult } from '@/services/fallbackEngine';
import type { CobaltData } from '@/services/fallbackEngine';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function extractUsableUrl(response: CobaltData | null): string | null {
  if (!response) return null;
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
        headers: { 'User-Agent': UA },
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

  const videoResponse = await fetchCobaltResult(url, {
    downloadMode: 'auto',
    videoQuality: '1080',
  });
  const videoUrl = extractUsableUrl(videoResponse);
  if (!videoUrl) {
    throw new ExtractionError(
      'Cobalt fallback instances could not extract this video. Please try again later, or set COBALT_API_URL to a working Cobalt instance.',
      'COBALT_FAILED',
    );
  }

  const formats: MediaFormat[] = [
    {
      id: 'cobalt-video',
      kind: 'video',
      label: 'Ultra HD Video',
      quality: '1080p',
      ext: 'mp4',
      url: videoUrl,
      size: null,
    },
  ];

  const audioResponse = await fetchCobaltResult(url, {
    downloadMode: 'audio',
    audioFormat: 'mp3',
  });
  const audioUrl = extractUsableUrl(audioResponse);
  if (audioUrl) {
    formats.push({
      id: 'cobalt-audio',
      kind: 'audio',
      label: 'MP3 Audio',
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
