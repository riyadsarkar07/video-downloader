import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { COOKIES_FILE, EXTRACT_TIMEOUT_MS, FFMPEG_BIN, MAX_FILESIZE, YTDLP_BIN } from './config.js';

export class YtDlpError extends Error {
  constructor(message, code = 'YTDLP_FAILED') {
    super(message);
    this.name = 'YtDlpError';
    this.code = code;
  }
}

function ffmpegLocation() {
  if (FFMPEG_BIN.endsWith('/ffmpeg') || FFMPEG_BIN === 'ffmpeg') {
    return FFMPEG_BIN.replace(/\/ffmpeg$/, '') || '/usr/bin';
  }
  return FFMPEG_BIN;
}

function commonArgs() {
  const args = [
    '--no-warnings',
    '--no-playlist',
    '--no-cache-dir',
    '--socket-timeout',
    '20',
    '--retries',
    '2',
    '--fragment-retries',
    '3',
    '--max-filesize',
    MAX_FILESIZE,
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    '--ffmpeg-location',
    ffmpegLocation(),
    '--extractor-args',
    'youtube:player_client=android,ios,tv,web;youtubetab:skip=authcheck',
  ];
  if (COOKIES_FILE && existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }
  return args;
}

function spawnEnv() {
  return {
    PATH: `/usr/bin:/usr/local/bin:${process.env.PATH || ''}`,
    HOME: process.env.HOME || '/tmp',
    LANG: process.env.LANG || 'C.UTF-8',
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
  };
}

export function runYtDlp(args, { timeoutMs = EXTRACT_TIMEOUT_MS, onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: spawnEnv(),
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      if (!settled) {
        settled = true;
        reject(new YtDlpError('The request timed out. Try a shorter video or try again later.', 'TIMEOUT'));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (onStderr) onStderr(text);
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(new YtDlpError(`Failed to start yt-dlp: ${error.message}`, 'SPAWN_FAILED'));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(mapYtDlpFailure(stderr || stdout, code));
    });
  });
}

export function mapYtDlpFailure(stderr, code) {
  const text = String(stderr || '');
  const youtube = /\[youtube]/i.test(text);

  if (/sign in to confirm|confirm you.re not a bot|bot check|captcha/i.test(text)) {
    return new YtDlpError(
      youtube
        ? 'YouTube is blocking this server IP with a bot check. The downloader cannot bypass that. A server operator may set YTDLP_COOKIES to a Netscape cookies file; we never collect or use your personal cookies.'
        : 'This platform is blocking automated access from this server. We do not bypass CAPTCHA or login walls.',
      'BOT_CHECK',
    );
  }
  if (/account authentication is required|use --cookies|login required|only works when logged-in|members.?only/i.test(text)) {
    return new YtDlpError(
      'This source requires a logged-in session. Private, age-gated, and login-only media are not downloaded.',
      'AUTH_REQUIRED',
    );
  }
  if (/private video|this video is private|this video is not available/i.test(text)) {
    return new YtDlpError('This video is private, age-restricted, or requires login.', 'PRIVATE');
  }
  if (/rate.?limit|too many requests|http error 429/i.test(text)) {
    return new YtDlpError('The source is rate-limiting this server. Wait a few minutes and try again.', 'RATE_LIMITED');
  }
  if (/unavailable|removed|does not exist|video has been deleted|http error 404/i.test(text)) {
    return new YtDlpError('This video is unavailable or has been removed.', 'UNAVAILABLE');
  }
  if (/unsupported url|no video formats|requested format is not available/i.test(text)) {
    return new YtDlpError('This URL is not supported or has no downloadable media.', 'UNSUPPORTED');
  }
  if (/geo.?restrict|not available in your country/i.test(text)) {
    return new YtDlpError('This video is geo-restricted and cannot be downloaded from this server.', 'GEO');
  }
  if (/drm|widevine|protected content/i.test(text)) {
    return new YtDlpError('DRM-protected content cannot be downloaded.', 'DRM');
  }
  if (/timed? ?out|connection timed out|temporary failure in name resolution/i.test(text)) {
    return new YtDlpError('The source timed out. Try again, or use a shorter / direct media URL.', 'TIMEOUT');
  }
  const last = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^ERROR:/i.test(line))
    .pop();
  if (last) {
    const cleaned = last.replace(/^ERROR:\s*/i, '').replace(/\s+See\s+https?:\S+/gi, '').trim();
    return new YtDlpError(
      cleaned.length > 220 ? 'Could not extract this media. The source may be private, restricted, or unsupported.' : cleaned,
      `EXIT_${code ?? 'ERR'}`,
    );
  }
  return new YtDlpError(
    'Could not extract this media. The video may be private, restricted, or unsupported.',
    `EXIT_${code ?? 'ERR'}`,
  );
}

export async function extractInfo(url) {
  const args = [
    ...commonArgs(),
    '--dump-single-json',
    '--skip-download',
    url,
  ];
  const { stdout } = await runYtDlp(args, { timeoutMs: EXTRACT_TIMEOUT_MS });
  const jsonStart = stdout.indexOf('{');
  if (jsonStart === -1) {
    throw new YtDlpError('yt-dlp returned empty metadata.', 'EMPTY_INFO');
  }
  try {
    return JSON.parse(stdout.slice(jsonStart));
  } catch {
    throw new YtDlpError('Could not parse video metadata.', 'BAD_JSON');
  }
}

export function spawnDownload(url, outputTemplate, preset, onStderr) {
  const args = [
    ...commonArgs(),
    '--newline',
    '--progress',
    '--no-mtime',
    '--no-part',
    '-o',
    outputTemplate,
    '-f',
    preset.selector,
  ];

  if (preset.merge) {
    args.push('--merge-output-format', preset.merge);
  }
  if (preset.audioFormat) {
    args.push(
      '-x',
      '--audio-format',
      preset.audioFormat,
      '--audio-quality',
      '0',
      '--postprocessor-args',
      'ffmpeg:-vn',
    );
  }

  args.push('--restrict-filenames', '-N', '4', url);

  const child = spawn(YTDLP_BIN, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: spawnEnv(),
  });

  child.stderr.on('data', (chunk) => {
    if (onStderr) onStderr(chunk.toString());
  });
  child.stdout.on('data', (chunk) => {
    if (onStderr) onStderr(chunk.toString());
  });

  return child;
}

export async function engineVersions() {
  const run = (bin, flag) =>
    new Promise((resolve) => {
      const child = spawn(bin, [flag], { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv() });
      let out = '';
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        done(out.trim().split(/\r?\n/)[0] || null);
      }, 4000);
      child.stdout.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        out += chunk.toString();
      });
      child.on('close', () => done(out.trim().split(/\r?\n/)[0] || null));
      child.on('error', () => done(null));
    });

  const [ytDlp, ffmpeg] = await Promise.all([run(YTDLP_BIN, '--version'), run(FFMPEG_BIN, '-version')]);
  return { ytDlp, ffmpeg: ffmpeg ? ffmpeg.replace(/^ffmpeg version /i, '').split(' ')[0] : null };
}

export function parseProgress(line) {
  const percent = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  if (percent) {
    return { percent: Math.min(99, Number(percent[1])), stage: 'downloading' };
  }
  if (/\[Merger]|\[ExtractAudio]|\[VideoConvertor]|\[ffmpeg]/i.test(line)) {
    return { percent: 92, stage: 'processing' };
  }
  if (/Destination:/i.test(line)) {
    return { percent: 8, stage: 'starting' };
  }
  return null;
}
