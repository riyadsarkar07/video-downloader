import type { Metadata } from 'next';
import { InfoPage } from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch about UniDown.',
};

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="Contact"
      title="Contact"
      intro="If a public link fails, include the platform and a description of the page type. Do not send private or login-only URLs that you are not allowed to access."
      sections={[
        {
          heading: 'Broken public links',
          body: 'Platforms change often. Share the site name and whether the page is a standard video, Short, Reel, or similar public post.',
        },
        {
          heading: 'Self-hosting',
          body: 'For deployment issues, check README.md. The frontend can stay on Vercel, but downloads must run on a server that has yt-dlp and FFmpeg.',
        },
      ]}
    />
  );
}
