import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Universal Media Downloader — YouTube, Facebook & Pinterest';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(120deg, #1e1b4b 0%, #0b0f1a 45%, #1e1b4b 100%)',
          fontFamily: 'sans-serif',
        }}
      >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: 'linear-gradient(120deg, #6366f1, #8b5cf6, #ec4899, #f59e0b)',
              padding: '18px 36px',
              borderRadius: '24px',
              color: 'white',
              fontWeight: 900,
              fontSize: '52px',
            }}
          >
            Universal Media Downloader
          </div>
        <div
          style={{
            marginTop: '28px',
            color: '#94a3b8',
            fontSize: '30px',
          }}
        >
          YouTube · Facebook · Pinterest — Video, MP3 & HD Images
        </div>
      </div>
    ),
    { ...size },
  );
}
