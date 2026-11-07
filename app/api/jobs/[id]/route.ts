import { proxyJson } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: { id: string } },
): Promise<Response> {
  return proxyJson(`/api/jobs/${encodeURIComponent(context.params.id)}`);
}
