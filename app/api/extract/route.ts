import { NextResponse } from 'next/server';
import { extractMedia } from '@/services/extractor';
import { ExtractionError } from '@/services/http';
import { normalizeUrl } from '@/lib/platforms';
import type { ExtractResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractBody {
  url?: unknown;
}

export async function POST(request: Request): Promise<NextResponse<ExtractResponse>> {
  let body: ExtractBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request payload.' },
      { status: 400 },
    );
  }

  const rawUrl = typeof body.url === 'string' ? body.url : '';
  if (!rawUrl.trim()) {
    return NextResponse.json(
      { success: false, error: 'Please paste a link first.' },
      { status: 400 },
    );
  }

  const url = normalizeUrl(rawUrl);
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return NextResponse.json(
      { success: false, error: 'The URL you provided is not valid.' },
      { status: 400 },
    );
  }

  try {
    const data = await extractMedia(url);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ExtractionError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 422 },
      );
    }
    console.error('Unexpected extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Something went wrong while extracting this media. Please try again.',
      },
      { status: 500 },
    );
  }
}
