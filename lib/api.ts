export const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

export async function proxyToBackend(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const target = `${BACKEND_URL}${path}`;
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  try {
    return await fetch(target, {
      ...init,
      headers,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'The download server is unreachable. Start the backend on port 3001.',
        code: 'BACKEND_UNREACHABLE',
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }
}

export async function proxyJson(path: string, init: RequestInit = {}): Promise<Response> {
  const upstream = await proxyToBackend(path, init);
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}
