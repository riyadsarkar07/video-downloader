import { NextResponse } from 'next/server';
import { sanitizeFilename, ensureExtension, getExtensionFromMime } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0', 'metadata.google.internal'];

function isBlockedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))) {
      return true;
    }
    if (parsed.hostname === '10.0.0.1') return true;
    const ipv4 = parsed.hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const parts = ipv4.slice(1).map(Number);
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function buildContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url') ?? '';
  const requestedFilename = searchParams.get('filename') ?? '';

  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid media URL.' },
      { status: 400 },
    );
  }

  if (isBlockedUrl(rawUrl)) {
    return NextResponse.json(
      { success: false, error: 'This media URL is not allowed.' },
      { status: 400 },
    );
  }

  const rangeHeader = request.headers.get('range');

  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        accept: '*/*',
        ...(rangeHeader ? { range: rangeHeader } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(180000),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Could not reach the media source.' },
      { status: 502 },
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { success: false, error: `The media source returned status ${upstream.status}.` },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const ext = getExtensionFromMime(contentType);
  const baseName = sanitizeFilename(requestedFilename, 'download');
  const filename = ensureExtension(baseName, ext);

  const headers = new Headers();
  headers.set('Content-Disposition', buildContentDisposition(filename));
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');

  const upstreamContentLength = upstream.headers.get('content-length');
  const upstreamContentRange = upstream.headers.get('content-range');
  const upstreamAcceptRanges = upstream.headers.get('accept-ranges');

  if (rangeHeader && upstream.status === 206) {
    headers.set('Content-Range', upstreamContentRange ?? '');
    if (upstreamContentLength) headers.set('Content-Length', upstreamContentLength);
    headers.set('Content-Type', contentType);
    return new Response(upstream.body, { status: 206, headers });
  }

  if (upstreamContentLength && upstreamContentLength !== '0') {
    headers.set('Content-Length', upstreamContentLength);
  }

  if (upstreamAcceptRanges) {
    headers.set('Accept-Ranges', upstreamAcceptRanges);
  }

  return new Response(upstream.body, { status: 200, headers });
}
