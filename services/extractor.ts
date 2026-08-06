import type { MediaInfo, Platform } from '@/lib/types';
import { detectPlatform } from '@/lib/platforms';
import { ExtractionError } from '@/services/http';
import { extractYouTube } from '@/services/youtube';
import { extractFacebook } from '@/services/facebook';
import { extractPinterest } from '@/services/pinterest';

const EXTRACTORS: Record<Platform, (url: string) => Promise<MediaInfo>> = {
  youtube: extractYouTube,
  facebook: extractFacebook,
  pinterest: extractPinterest,
};

export async function extractMedia(url: string): Promise<MediaInfo> {
  const platform = detectPlatform(url);
  if (!platform) {
    throw new ExtractionError(
      'This link is not supported. Please paste a valid YouTube, Facebook, or Pinterest link.',
      'UNSUPPORTED_PLATFORM',
    );
  }
  return EXTRACTORS[platform](url);
}
