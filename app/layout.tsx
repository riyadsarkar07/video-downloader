import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { I18nProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://video-downloader-peach-xi.vercel.app'),
  title: {
    default: 'UniDown — Real Video Downloader',
    template: '%s · UniDown',
  },
  description:
    'Download public videos as MP4 or MP3 with real server-side processing. Direct media URLs, public Facebook, and public TikTok were verified. Other sites work only when the source allows anonymous access.',
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0b0f1a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <I18nProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <Toaster position="bottom-center" />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
