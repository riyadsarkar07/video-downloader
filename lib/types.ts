export type Platform = 'youtube' | 'facebook' | 'pinterest';

export type MediaKind = 'video' | 'audio' | 'image';

export interface MediaFormat {
  id: string;
  kind: MediaKind;
  label: string;
  quality: string;
  ext: 'mp4' | 'mp3' | 'jpg' | 'webm' | 'm4a';
  url: string;
  size: number | null;
  width?: number;
  height?: number;
}

export interface MediaInfo {
  platform: Platform;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  author: string | null;
  formats: MediaFormat[];
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
