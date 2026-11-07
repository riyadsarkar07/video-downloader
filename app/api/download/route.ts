import { proxyJson } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  return proxyJson('/api/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}
