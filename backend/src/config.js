import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

export const PORT = Number(process.env.PORT || 3001);
export const HOST = process.env.HOST || '0.0.0.0';
export const TRUST_PROXY = process.env.TRUST_PROXY || 'loopback';

export const TMP_DIR = process.env.DOWNLOAD_TMP_DIR
  ? path.resolve(process.env.DOWNLOAD_TMP_DIR)
  : path.join(os.tmpdir(), 'unidown-jobs');

export const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';
export const FFMPEG_BIN = process.env.FFMPEG_BIN || '/usr/bin/ffmpeg';
export const COOKIES_FILE = process.env.YTDLP_COOKIES || '';

export const EXTRACT_TIMEOUT_MS = Number(process.env.EXTRACT_TIMEOUT_MS || 45_000);
export const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS || 300_000);
export const JOB_TTL_MS = Number(process.env.JOB_TTL_MS || 15 * 60_000);
export const MAX_CONCURRENT_JOBS = Number(process.env.MAX_CONCURRENT_JOBS || 2);
export const MAX_QUEUED_JOBS = Number(process.env.MAX_QUEUED_JOBS || 40);
export const MAX_FILESIZE = process.env.MAX_FILESIZE || '500M';
export const MAX_DURATION_SEC = Number(process.env.MAX_DURATION_SEC || 3 * 60 * 60);
export const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export const EXTRACT_RATE_LIMIT = Number(process.env.EXTRACT_RATE_LIMIT || 20);
export const DOWNLOAD_RATE_LIMIT = Number(process.env.DOWNLOAD_RATE_LIMIT || 8);
export const FILE_RATE_LIMIT = Number(process.env.FILE_RATE_LIMIT || 60);

mkdirSync(TMP_DIR, { recursive: true });

export const FORMAT_PRESETS = {
  'video-best': {
    kind: 'video',
    ext: 'mp4',
    label: 'Best available MP4',
    selector: 'bv*+ba/b',
    merge: 'mp4',
  },
  'video-1080': {
    kind: 'video',
    ext: 'mp4',
    label: '1080p MP4',
    selector: 'bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b',
    merge: 'mp4',
  },
  'video-720': {
    kind: 'video',
    ext: 'mp4',
    label: '720p MP4',
    selector: 'bv*[height<=720]+ba/b[height<=720]/bv*+ba/b',
    merge: 'mp4',
  },
  'video-480': {
    kind: 'video',
    ext: 'mp4',
    label: '480p MP4',
    selector: 'bv*[height<=480]+ba/b[height<=480]/bv*+ba/b',
    merge: 'mp4',
  },
  'video-360': {
    kind: 'video',
    ext: 'mp4',
    label: '360p MP4',
    selector: 'bv*[height<=360]+ba/b[height<=360]/bv*+ba/b',
    merge: 'mp4',
  },
  'audio-mp3': {
    kind: 'audio',
    ext: 'mp3',
    label: 'MP3 Audio',
    selector: 'ba/b',
    audioFormat: 'mp3',
  },
};
