import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://unidownloader.vercel.app'),
  title: {
    default: 'Universal Media Downloader — YouTube, Facebook & Pinterest',
    template: '%s · Universal Media Downloader',
  },
  description:
    'Download videos, MP3 audio, and high-resolution images from YouTube, Facebook, and Pinterest for free. No API keys, no sign-ups, direct save-file downloads on mobile and desktop.',
  keywords: [
    'video downloader',
    'youtube downloader',
    'facebook downloader',
    'pinterest downloader',
    'mp3 downloader',
    'hd video download',
  ],
  openGraph: {
    type: 'website',
    url: 'https://unidownloader.vercel.app',
    siteName: 'Universal Media Downloader',
    title: 'Universal Media Downloader — YouTube, Facebook & Pinterest',
    description:
      'Save videos, MP3 audio, and high-resolution images from YouTube, Facebook, and Pinterest — directly to your device in one tap.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Universal Media Downloader',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Universal Media Downloader — YouTube, Facebook & Pinterest',
    description:
      'Save videos, MP3 audio, and high-resolution images from YouTube, Facebook, and Pinterest — directly to your device in one tap.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0f1a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e8f0',
            },
          }}
        />
      </body>
    </html>
  );
}
