import type { MediaInfo, Platform } from '@/lib/types';
import { cleanInputUrl, detectPlatform } from '@/lib/platforms';
import { ExtractionError } from '@/services/http';
import { extractYouTube } from '@/services/youtube';
import { extractFacebook } from '@/services/facebook';
import { extractInstagram } from '@/services/instagram';
import { extractTikTok } from '@/services/tiktok';
import { extractTwitter } from '@/services/twitter';
import { extractThreads } from '@/services/threads';
import { extractPinterest } from '@/services/pinterest';

const EXTRACTORS: Record<Platform, (url: string) => Promise<MediaInfo>> = {
  youtube: extractYouTube,
  facebook: extractFacebook,
  instagram: extractInstagram,
  tiktok: extractTikTok,
  twitter: extractTwitter,
  threads: extractThreads,
  pinterest: extractPinterest,
};

const SUPPORTED_LABEL =
  'YouTube, Facebook, Instagram, TikTok, X / Twitter, Threads, or Pinterest';

export async function extractMedia(url: string): Promise<MediaInfo> {
  const cleaned = cleanInputUrl(url);
  const platform = detectPlatform(cleaned);
  if (!platform) {
    throw new ExtractionError(
      `This link is not supported. Please paste a valid ${SUPPORTED_LABEL} link.`,
      'UNSUPPORTED_PLATFORM',
    );
  }
  return EXTRACTORS[platform](cleaned);
}
