export function clsx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function sanitizeFilename(input: string, fallback = 'download'): string {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120)
    .trim();

  const safe = cleaned || fallback;
  return safe.replace(/[. ]+$/g, '');
}

export function ensureExtension(filename: string, ext: string): string {
  const normalizedExt = ext.startsWith('.') ? ext.slice(1) : ext;
  if (new RegExp(`\\.${normalizedExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(filename)) {
    return filename;
  }
  return `${filename}.${normalizedExt}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) {
    return '--:--';
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes) || bytes <= 0) {
    return '';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function getExtensionFromMime(mime: string | null): string {
  const normalized = (mime ?? '').toLowerCase();
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('m4a')) return 'm4a';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('quicktime')) return 'mov';
  if (normalized.includes('ogg')) return 'ogg';
  return 'mp4';
}

export function getExtensionFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const match = path.match(/\.([a-z0-9]{2,5})$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function buildDownloadUrl(url: string, filename: string): string {
  const params = new URLSearchParams({
    url,
    filename,
  });
  return `/api/download-stream?${params.toString()}`;
}
