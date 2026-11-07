export type Platform =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'reddit'
  | 'vimeo'
  | 'generic';

export type MediaKind = 'video' | 'audio';

export interface MediaFormat {
  id: string;
  kind: MediaKind;
  label: string;
  quality: string;
  ext: 'mp4' | 'mp3' | 'webm' | 'm4a';
  filesize: number | null;
}

export interface MediaInfo {
  platform: Platform | string;
  extractor?: string;
  id?: string;
  title: string;
  filenameBase?: string;
  thumbnail: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  author: string | null;
  webpageUrl?: string | null;
  formats: MediaFormat[];
}

export interface DownloadJob {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  progress: number;
  stage: string;
  error: string | null;
  filename: string | null;
  ext: string | null;
  filesize: number | null;
  title: string | null;
}

export interface ExtractSuccessResponse {
  success: true;
  data: MediaInfo;
}

export interface ExtractErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export type ExtractResponse = ExtractSuccessResponse | ExtractErrorResponse;
