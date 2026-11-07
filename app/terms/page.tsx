import type { Metadata } from 'next';
import { InfoPage } from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for UniDown.',
};

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="By using UniDown you agree to use it only for lawful, authorized downloads of public media."
      sections={[
        {
          heading: 'Acceptable use',
          body: 'Only download content you own, have permission to save, or that is otherwise lawful to download in your jurisdiction. Respect copyright and platform terms.',
        },
        {
          heading: 'No bypassing restrictions',
          body: 'The service does not bypass DRM, paywalls, private accounts, age gates, or authentication. Requests for restricted media will fail.',
        },
        {
          heading: 'No warranty',
          body: 'Extraction depends on public source availability. Platforms change their APIs, and some videos will not be downloadable.',
        },
        {
          heading: 'Liability',
          body: 'You are responsible for how you use downloaded files. UniDown is provided as-is for personal, lawful use.',
        },
      ]}
    />
  );
}
