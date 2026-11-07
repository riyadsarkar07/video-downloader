import { proxyToBackend } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(
  _request: Request,
  context: { params: { id: string } },
): Promise<Response> {
  const upstream = await proxyToBackend(`/api/jobs/${encodeURIComponent(context.params.id)}/file`);
  const headers = new Headers();
  const pass = [
    'content-type',
    'content-disposition',
    'content-length',
    'cache-control',
    'x-content-type-options',
  ];
  for (const key of pass) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, headers });
}
