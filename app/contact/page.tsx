import type { Metadata } from 'next';
import { InfoPage } from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the Universal Media Downloader team.',
};

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="Contact"
      title="Contact us"
      intro="Found a bug or want to suggest a feature? We would love to hear from you."
      sections={[
        {
          heading: 'Report a broken link',
          body: 'Platforms constantly change their page structures. If a link fails to extract, share the platform and the type of content (video, reel, pin) so we can reproduce and fix it quickly.',
        },
        {
          heading: 'Get in touch',
          body: 'Open an issue on our GitHub repository with a clear description of the problem. For general inquiries, you can reach the maintainers through the repository discussions board.',
        },
        {
          heading: 'Response time',
          body: 'We aim to respond to all reports within 48 hours. Your feedback helps keep the downloader fast and reliable for everyone.',
        },
      ]}
    />
  );
}
