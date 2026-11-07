'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Lang = 'en' | 'bn';

const en = {
  howItWorks: 'How it works',
  platforms: 'Platforms',
  faq: 'FAQ',
  features: 'Features',

  heroBadge: 'Real downloads · yt-dlp engine · No fake progress',
  heroTitle1: 'Download videos',
  heroTitle2: 'the professional way',
  heroTitle3: '',
  heroSubtitle:
    'Paste a public video link. We extract real metadata, let you pick quality, then process the file on the server and send it to your browser.',

  inputPlaceholder: 'Paste a YouTube, TikTok, Facebook, Instagram, X, Reddit, or Vimeo URL…',
  clearInput: 'Clear input',
  paste: 'Paste',
  pasteFromClipboard: 'Paste from clipboard',
  extract: 'Fetch video',
  extracting: 'Fetching…',
  detectedPlatform: 'Detected',
  linkPasted: 'Link pasted from clipboard',
  clipboardEmpty: 'Clipboard is empty',
  clipboardBlocked: 'Clipboard access is blocked in this browser',
  clipboardManual: 'Could not read the clipboard. Paste manually instead.',
  pasteLinkFirst: 'Please paste a link first',
  linkNotSupported: 'This link is not supported',
  mediaReady: 'Video ready — choose a format and download',
  genericError: 'Something went wrong. Please try again.',
  extractionFailed: 'Could not fetch this video',
  networkError: 'Network error. Please check your connection and try again.',
  serverUnreachable: 'Could not reach the download server',
  processing: 'Processing your link…',

  customFilename: 'Filename (optional)',
  downloadOptions: 'Quality & format',
  save: 'Download',
  starting: 'Starting…',
  downloading: 'Downloading {label}',
  downloadDisclaimer:
    'Only download content you have the right to save. DRM, private, and paywalled videos are not supported.',
  options: 'options',
  option: 'option',
  tierUltra: 'Best / 1080p+',
  tierHd: 'HD / 720p',
  tierSd: 'SD',
  tierAudio: 'MP3 Audio',
  tierImage: 'Image',
  thumbnailButton: 'Download thumbnail',
  thumbnailCaption: 'JPG',
  queued: 'Queued',
  processingFile: 'Processing on server',
  merging: 'Merging video and audio',
  ready: 'Ready',
  failed: 'Failed',
  preparingFile: 'Preparing your file…',
  downloadReady: 'Your file is ready',
  saveToDevice: 'Save to device',
  selectedQuality: 'Selected',

  howItWorksBadge: 'Workflow',
  howItWorksTitle: 'From URL to a real file',
  step1Title: 'Paste a public URL',
  step1Desc: 'We validate the link, detect the platform, and reject private or unsafe addresses.',
  step2Title: 'Inspect real metadata',
  step2Desc: 'The server uses yt-dlp to read title, duration, thumbnail, and available qualities.',
  step3Title: 'Process, then download',
  step3Desc: 'A background job fetches and merges streams. Your browser then receives the actual file.',
  howItWorksNote: 'Vercel is used for the UI. Long downloads run on a dedicated Node.js server with yt-dlp and FFmpeg.',

  platformsBadge: 'Coverage',
  platformsTitle: 'Built for public video links',
  platformsSubtitle: 'Reliable extractors first. We never bypass DRM, logins, or paywalls.',

  featYt1: 'MP4 up to best available',
  featYt2: 'MP3 audio extraction',
  featYt3: 'Shorts and standard videos',
  featFb1: 'Public videos and Reels',
  featFb2: 'Quality selection',
  featFb3: 'No login wall bypass',
  featIg1: 'Public Reels and posts',
  featIg2: 'MP4 download',
  featIg3: 'Public content only',
  featTt1: 'Public TikTok videos',
  featTt2: 'MP4 output',
  featTt3: 'Audio extraction',
  featX1: 'Public X videos',
  featX2: 'MP4 download',
  featX3: 'Public posts only',
  featRd1: 'Public Reddit videos',
  featRd2: 'MP4 download',
  featRd3: 'Audio extraction',
  featVm1: 'Public Vimeo videos',
  featVm2: 'Quality selection',
  featVm3: 'MP4 output',

  faqBadge: 'FAQ',
  faqTitle: 'Frequently asked questions',
  faq1q: 'Is this a real downloader?',
  faq1a:
    'Yes. Metadata and files are processed on a dedicated backend with yt-dlp and FFmpeg. Progress comes from the actual job, not a fake timer.',
  faq2q: 'Why not host downloads on Vercel?',
  faq2a:
    'Vercel serverless functions have short timeouts and no persistent disk. Video processing needs a long-running Node.js server, which is why the backend is separate.',
  faq3q: 'Which formats can I download?',
  faq3a:
    'MP4 video at the best available quality plus 1080p, 720p, 480p, and 360p when the source provides them. Audio is exported as MP3 when the source has an audio track.',
  faq4q: 'Why do some videos fail?',
  faq4a:
    'Private, age-gated, geo-blocked, DRM-protected, or login-required videos cannot be downloaded. That is intentional and lawful.',
  faq5q: 'Do you store my videos?',
  faq5a:
    'Temporary files live on the server only while the job is active, then they are deleted automatically. We do not keep a media library.',
  faq6q: 'Can I download copyrighted content?',
  faq6a:
    'Only download media you own or have permission to save. This tool is for personal backups of public content you are allowed to keep.',

  seoBadge: 'Notes',
  seoTitle: 'What this tool will and will not do',
  seoSubtitle: 'Clear limits keep the downloader reliable and lawful.',
  seoGuideFbReels: 'Public Facebook videos',
  seoGuideFbReelsText: 'Public Reels and videos can be fetched. Private or login-only posts will fail with a clear error.',
  seoGuideTiktok: 'Public TikTok videos',
  seoGuideTiktokText: 'Paste a public TikTok URL. The server processes the video and returns an MP4 file.',
  seoGuidePinterest: 'Direct video URLs',
  seoGuidePinterestText: 'If yt-dlp recognizes a public page or a direct media URL, it can still extract metadata and download it.',
  seoGuideInstagram: 'Public Instagram media',
  seoGuideInstagramText: 'Public Reels and posts may work. Stories, private accounts, and login walls are not bypassed.',
  seoGuideX: 'Public X videos',
  seoGuideXText: 'Public video posts can be processed. Protected accounts and DRM streams are rejected.',
  seoGuideThreads: 'Reddit and Vimeo',
  seoGuideThreadsText: 'Public Reddit and Vimeo links are supported through the same yt-dlp pipeline.',
  seoGuideYoutube: 'YouTube videos and MP3',
  seoGuideYoutubeText: 'Paste a public watch or Shorts URL, pick quality, then download the processed MP4 or MP3.',
  seoLegalNote: 'Respect creators, platform terms, and copyright law. We do not bypass DRM or authentication.',

  footerTagline: 'A real video downloader with server-side processing, quality selection, and honest limits.',
  footerSupported: 'Supported',
  footerResources: 'Resources',
  footerPrivacy: 'Privacy Policy',
  footerTerms: 'Terms of Service',
  footerContact: 'Contact',
  footerNoData: 'Temporary files only',
  footerDesigned: 'Built for',
  footerBy: 'personal, lawful downloads',
  footerRights: 'All rights reserved',
  footerPlatformYt: 'YouTube MP4 & MP3',
  footerPlatformFb: 'Public Facebook video',
  footerPlatformIg: 'Public Instagram Reels',
  footerPlatformTt: 'Public TikTok',
  footerPlatformX: 'Public X video',
  footerPlatformTh: 'Reddit video',
  footerPlatformPin: 'Vimeo & direct URLs',
} as const;

export type DictKey = keyof typeof en;

const bn: Record<DictKey, string> = { ...en };

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: DictKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = 'unidownloader-lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'bn') setLangState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'en' ? 'bn' : 'en')), []);

  const t = useCallback(
    (key: DictKey, params?: Record<string, string | number>) => {
      let text = lang === 'bn' ? bn[key] : en[key];
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
}
