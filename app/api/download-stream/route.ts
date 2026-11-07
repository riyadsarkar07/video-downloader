import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint has been replaced. Use /api/download and /api/jobs/:id/file.',
    },
    { status: 410 },
  );
}
