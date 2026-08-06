import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Universal Media Downloader';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f1a',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          fontWeight: 800,
          fontSize: '56px',
        }}
      >
        Universal Social Media Downloader
      </div>
    ),
    { ...size },
  );
}
