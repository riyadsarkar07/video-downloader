'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Clock,
  Download,
  FilePenLine,
  Film,
  HardDrive,
  ImageIcon,
  Loader2,
  Music,
} from 'lucide-react';
import { PLATFORM_META } from '@/lib/platforms';
import { buildDownloadUrl, clsx, ensureExtension, formatBytes, formatDuration } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import type { MediaFormat, MediaInfo } from '@/lib/types';
import { PlatformIcon } from '@/components/icons';

interface MediaPreviewProps {
  info: MediaInfo;
}

type Tier = 'ultra' | 'hd' | 'sd' | 'audio' | 'image';

const KIND_ICON = {
  video: Film,
  audio: Music,
  image: ImageIcon,
} as const;

const TIER_META: Record<
  Tier,
  { labelKey: 'tierUltra' | 'tierHd' | 'tierSd' | 'tierAudio' | 'tierImage'; badge: string; button: string }
> = {
  ultra: {
    labelKey: 'tierUltra',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-400/30',
    button:
      'border-purple-400/30 bg-gradient-to-br from-purple-600/25 via-purple-500/10 to-fuchsia-600/25 hover:border-purple-300/60 hover:from-purple-500/40 hover:to-fuchsia-500/30',
  },
  hd: {
    labelKey: 'tierHd',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
    button:
      'border-sky-400/30 bg-gradient-to-br from-sky-600/25 via-sky-500/10 to-blue-600/25 hover:border-sky-300/60 hover:from-sky-500/40 hover:to-blue-500/30',
  },
  sd: {
    labelKey: 'tierSd',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    button:
      'border-emerald-400/30 bg-gradient-to-br from-emerald-600/25 via-emerald-500/10 to-teal-600/25 hover:border-emerald-300/60 hover:from-emerald-500/40 hover:to-teal-500/30',
  },
  audio: {
    labelKey: 'tierAudio',
    badge: 'bg-pink-500/15 text-pink-300 border-pink-400/30',
    button:
      'border-pink-400/30 bg-gradient-to-br from-pink-600/25 via-pink-500/10 to-rose-600/25 hover:border-pink-300/60 hover:from-pink-500/40 hover:to-rose-500/30',
  },
  image: {
    labelKey: 'tierImage',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    button:
      'border-amber-400/30 bg-gradient-to-br from-amber-600/25 via-amber-500/10 to-orange-600/25 hover:border-amber-300/60 hover:from-amber-500/40 hover:to-orange-500/30',
  },
};

function getTier(format: MediaFormat): Tier {
  if (format.kind === 'audio') return 'audio';
  if (format.kind === 'image') return 'image';
  const height = Number(format.quality.match(/(\d{3,4})/)?.[1] ?? 0);
  if (height >= 1080) return 'ultra';
  if (height >= 720) return 'hd';
  return 'sd';
}

export function MediaPreview({ info }: MediaPreviewProps) {
  const { t } = useI18n();
  const [customFilename, setCustomFilename] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const meta = PLATFORM_META[info.platform];

  const triggerDownload = (format: MediaFormat) => {
    const baseName = customFilename.trim() || info.title || 'download';
    const filename = ensureExtension(baseName, format.ext);
    const href = buildDownloadUrl(format.url, filename);

    setDownloadingId(format.id);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      setDownloadingId(null);
      toast.success(t('downloading', { label: format.label }));
    }, 1500);
  };

  const defaultName = info.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
  const baseName = customFilename.trim() || defaultName || 'download';

  const hasVideo = info.formats.some((format) => format.kind === 'video');
  const showThumbnail = Boolean(info.thumbnail) && (hasVideo || info.platform === 'youtube');

  const thumbnailFormat: MediaFormat | null = info.thumbnail
    ? {
        id: 'media-thumbnail-hd',
        kind: 'image',
        label: t('tierImage'),
        quality: 'HD / 4K',
        ext: 'jpg',
        url: info.thumbnail,
        size: null,
      }
    : null;

  const allFormats = showThumbnail && thumbnailFormat
    ? [...info.formats, thumbnailFormat]
    : info.formats;

  const firstFormat = info.formats[0] ?? thumbnailFormat;
  const firstBadge = firstFormat
    ? TIER_META[getTier(firstFormat)].badge
    : 'bg-brand-500/15 text-brand-300 border-brand-400/20';

  return (
    <motion.div
      exit={{ opacity: 0, y: -16, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="glass-card fade-in-up mt-5 overflow-hidden"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="relative aspect-video bg-slate-900 md:aspect-auto md:min-h-[240px]">
          {info.thumbnail ? (
            <img
              src={info.thumbnail}
              alt={info.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-hero-gradient/20">
              <Film className="h-12 w-12 text-white/40" aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                firstBadge,
              )}
            >
              <PlatformIcon platform={info.platform} className="h-3.5 w-3.5" />
              {meta.label}
            </span>
            {info.duration !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatDuration(info.duration)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col p-5 sm:p-6">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white sm:text-lg">
            {info.title}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            {info.duration !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {formatDuration(info.duration)}
              </span>
            )}
            {info.width && info.height && (
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {info.width} × {info.height}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" aria-hidden="true" />
              {allFormats.length} {allFormats.length === 1 ? t('option') : t('options')}
            </span>
          </div>

          <label className="mt-5 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <FilePenLine className="h-3.5 w-3.5" aria-hidden="true" />
              {t('customFilename')}
            </span>
            <div className="relative">
              <input
                type="text"
                value={customFilename}
                onChange={(event) => setCustomFilename(event.target.value)}
                placeholder={defaultName}
                className="input-base pr-16"
                aria-label="Custom filename"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                .{info.formats[0]?.ext ?? 'mp4'}
              </span>
            </div>
          </label>

          <div className="mt-5">
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('downloadOptions')}
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {allFormats.map((format) => {
                const Icon = KIND_ICON[format.kind];
                const tier = getTier(format);
                const tierMeta = TIER_META[tier];
                const isBusy = downloadingId === format.id;
                return (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => triggerDownload(format)}
                    disabled={downloadingId !== null}
                    className={clsx(
                      'group hover-lift relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border px-4 py-3 text-left',
                      tierMeta.button,
                      'disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute right-2.5 top-2 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        tierMeta.badge,
                      )}
                    >
                      {t(tierMeta.labelKey)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span
                        className={clsx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                          tierMeta.badge,
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 pr-16">
                        <span className="block truncate text-sm font-semibold text-white">
                          {format.label}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {format.quality}
                          {format.size ? ` · ${formatBytes(format.size)}` : ''}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-white/80 transition-colors group-hover:text-white">
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="hidden text-xs font-medium sm:inline">
                        {isBusy ? t('starting') : t('save')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <HardDrive className="h-3 w-3 shrink-0" aria-hidden="true" />
            {t('downloadDisclaimer')}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
