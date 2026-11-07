import type { Metadata } from 'next';
import { InfoPage } from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How UniDown handles URLs and temporary download files.',
};

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="UniDown processes public video URLs long enough to extract metadata and prepare a file. It is not a media library."
      sections={[
        {
          heading: 'What we process',
          body: 'The URL you submit is sent to the download server so yt-dlp can read public metadata and fetch the selected stream. We do not require accounts.',
        },
        {
          heading: 'Temporary files',
          body: 'Processed files are stored on disk only while the download job is active. They are deleted automatically after a short TTL or shortly after you save the file.',
        },
        {
          heading: 'Logs',
          body: 'The server may keep short operational logs such as platform name, status, and timing. We do not build a catalog of the videos you download.',
        },
        {
          heading: 'Cookies',
          body: 'Optional yt-dlp cookies are an operator-provided file for sites that block anonymous access. That file stays on the server and is never exposed to the browser.',
        },
      ]}
    />
  );
}
