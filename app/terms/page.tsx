import type { Metadata } from 'next';
import { InfoPage } from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for the Universal Media Downloader.',
};

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="By using Universal Media Downloader you agree to the following terms."
      sections={[
        {
          heading: 'Acceptable use',
          body: 'You agree to use this service only to download content that you own, have permission to download, or that is otherwise lawful to download in your jurisdiction. Respect the intellectual property rights of creators.',
        },
        {
          heading: 'No warranty',
          body: 'The service is provided “as is” without warranties of any kind. We do not guarantee that extraction will always succeed, as content availability depends entirely on the source platforms.',
        },
        {
          heading: 'Limitation of liability',
          body: 'We are not liable for any damages arising from your use of the service, including any misuse of downloaded content. You are solely responsible for how you use downloaded files.',
        },
        {
          heading: 'Changes',
          body: 'We may update these terms at any time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.',
        },
      ]}
    />
  );
}
