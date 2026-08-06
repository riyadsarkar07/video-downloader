import type { Metadata } from 'next';
import { InfoPage } from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Universal Media Downloader handles your data. We store nothing, period.',
};

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="We built this tool with a single privacy principle: we store nothing."
      sections={[
        {
          heading: 'Data collection',
          body: 'Universal Media Downloader does not require accounts, does not use cookies for tracking, and does not persist any of the links you submit. Every extraction request is processed in memory and discarded as soon as it completes.',
        },
        {
          heading: 'Server logs',
          body: 'Like any hosted service, our hosting provider (Vercel) may retain ephemeral request logs for operational and security purposes. These logs contain no meaningful content beyond technical metadata and are never sold or shared.',
        },
        {
          heading: 'Third parties',
          body: 'We do not embed third-party advertising, analytics trackers, or affiliate scripts. When you download a file, our server fetches it from the content platform and streams it directly to your device — no intermediaries receive the file.',
        },
        {
          heading: 'Your rights',
          body: 'You may stop using the service at any time. Because we store nothing, there is nothing to delete. For any privacy questions, reach out via our contact page.',
        },
      ]}
    />
  );
}
