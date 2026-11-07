import { FORMAT_PRESETS, MAX_DURATION_SEC } from './config.js';
import { sanitizeFilename } from './security.js';

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mkv', 'mov', 'm4v']);
const AUDIO_EXTS = new Set(['m4a', 'mp3', 'opus', 'ogg', 'aac', 'wav', 'flac', 'webm']);

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pickThumbnail(info) {
  if (typeof info.thumbnail === 'string' && info.thumbnail.startsWith('http')) {
    return info.thumbnail;
  }
  const thumbs = Array.isArray(info.thumbnails) ? info.thumbnails : [];
  const best = [...thumbs]
    .filter((item) => item?.url)
    .sort((a, b) => (Number(b.width || 0) * Number(b.height || 0)) - (Number(a.width || 0) * Number(a.height || 0)))[0];
  return best?.url || null;
}

function heightFromFormat(format) {
  if (format.height) return Number(format.height);
  const match = String(format.format_note || format.resolution || '').match(/(\d{3,4})p/);
  return match ? Number(match[1]) : 0;
}

function availableHeights(formats) {
  const heights = new Set();
  for (const format of formats) {
    if (!format) continue;
    const vcodec = format.vcodec && format.vcodec !== 'none';
    const height = heightFromFormat(format);
    if (vcodec && height >= 144) heights.add(height);
  }
  return [...heights].sort((a, b) => b - a);
}

function hasAudio(formats) {
  return formats.some((format) => format?.acodec && format.acodec !== 'none');
}

function hasVideo(formats) {
  return formats.some((format) => format?.vcodec && format.vcodec !== 'none');
}

function looksLikeVideo(info, formats) {
  if (hasVideo(formats)) return true;
  if (info.vcodec && info.vcodec !== 'none') return true;
  if (Number(info.width) > 0 && Number(info.height) > 0) return true;
  const ext = String(info.ext || '').toLowerCase();
  if (VIDEO_EXTS.has(ext)) return true;
  const url = String(info.url || info.webpage_url || '');
  return /\.(mp4|webm|mkv|mov|m4v)(\?|$)/i.test(url);
}

export function normalizeMedia(info, platform) {
  if (!info || typeof info !== 'object') {
    throw new Error('Empty media metadata.');
  }

  if (info._type === 'playlist') {
    const first = Array.isArray(info.entries) ? info.entries.find(Boolean) : null;
    if (first) return normalizeMedia(first, platform);
  }

  const duration = asNumber(info.duration);
  if (duration && duration > MAX_DURATION_SEC) {
    const err = new Error('This video is too long. Maximum duration is 3 hours.');
    err.code = 'TOO_LONG';
    throw err;
  }

  const formats = Array.isArray(info.formats) ? info.formats : [];
  const videoAvailable = looksLikeVideo(info, formats);
  const audioAvailable = hasAudio(formats) || Boolean(info.acodec && info.acodec !== 'none') || videoAvailable;
  const heights = availableHeights(formats);
  const title = sanitizeFilename(info.title || info.fulltitle || 'download', 'download');
  const thumbnail = pickThumbnail(info);
  const author = info.uploader || info.channel || info.creator || null;

  const options = [];

  if (videoAvailable) {
    options.push({
      id: 'video-best',
      kind: 'video',
      label: FORMAT_PRESETS['video-best'].label,
      quality: heights[0] ? `${heights[0]}p` : 'Best',
      ext: 'mp4',
      filesize: asNumber(info.filesize) || asNumber(info.filesize_approx),
    });

    const qualityMap = [
      { id: 'video-1080', min: 1080, label: '1080p MP4' },
      { id: 'video-720', min: 720, label: '720p MP4' },
      { id: 'video-480', min: 480, label: '480p MP4' },
      { id: 'video-360', min: 360, label: '360p MP4' },
    ];

    for (const item of qualityMap) {
      if (heights.some((height) => height >= item.min)) {
        options.push({
          id: item.id,
          kind: 'video',
          label: item.label,
          quality: `${item.min}p`,
          ext: 'mp4',
          filesize: null,
        });
      }
    }
  }

  if (audioAvailable || videoAvailable) {
    options.push({
      id: 'audio-mp3',
      kind: 'audio',
      label: FORMAT_PRESETS['audio-mp3'].label,
      quality: '192kbps',
      ext: 'mp3',
      filesize: null,
    });
  }

  if (!options.length) {
    const ext = String(info.ext || '').toLowerCase();
    if (VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext)) {
      options.push({
        id: videoAvailable ? 'video-best' : 'audio-mp3',
        kind: videoAvailable ? 'video' : 'audio',
        label: videoAvailable ? 'Best available' : 'Audio',
        quality: 'Default',
        ext: videoAvailable ? 'mp4' : 'mp3',
        filesize: asNumber(info.filesize),
      });
    }
  }

  if (!options.length) {
    const err = new Error('No downloadable formats were found for this URL.');
    err.code = 'NO_FORMATS';
    throw err;
  }

  const seen = new Set();
  const unique = options.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return {
    platform,
    extractor: info.extractor || info.extractor_key || platform,
    id: String(info.id || ''),
    title: info.title || info.fulltitle || 'Untitled',
    filenameBase: title,
    thumbnail,
    duration,
    width: asNumber(info.width),
    height: asNumber(info.height) || heights[0] || null,
    author,
    webpageUrl: info.webpage_url || info.original_url || null,
    formats: unique,
  };
}
