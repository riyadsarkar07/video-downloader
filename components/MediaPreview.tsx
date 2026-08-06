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
import type { MediaFormat, MediaInfo } from '@/lib/types';
import { PlatformIcon } from '@/components/icons';

interface MediaPreviewProps {
  info: MediaInfo;
}

const KIND_ICON = {
  video: Film,
  audio: Music,
  image: ImageIcon,
} as const;

const KIND_BADGE: Record<MediaFormat['kind'], string> = {
  video: 'bg-brand-500/15 text-brand-300 border-brand-400/20',
  audio: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  image: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
};

export function MediaPreview({ info }: MediaPreviewProps) {
  const [customFilename, setCustomFilename] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const meta = PLATFORM_META[info.platform];

  const handleDownload = (format: MediaFormat) => {
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
      toast.success(`Downloading ${format.label}`);
    }, 1500);
  };

  const defaultName = info.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120);
  const baseName = customFilename.trim() || defaultName || 'download';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.98 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="glass-card mt-5 overflow-hidden"
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
                KIND_BADGE[info.formats[0]?.kind ?? 'video'],
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
              {info.formats.length} option{info.formats.length === 1 ? '' : 's'}
            </span>
          </div>

          <label className="mt-5 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <FilePenLine className="h-3.5 w-3.5" aria-hidden="true" />
              Custom filename (optional)
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
              Download options
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {info.formats.map((format) => {
                const Icon = KIND_ICON[format.kind];
                const isBusy = downloadingId === format.id;
                return (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => handleDownload(format)}
                    disabled={downloadingId !== null}
                    className={clsx(
                      'group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                      'border-white/10 bg-white/[0.03] hover:border-brand-400/50 hover:bg-brand-500/10',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={clsx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                          KIND_BADGE[format.kind],
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {format.label}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {format.quality}
                          {format.size ? ` · ${formatBytes(format.size)}` : ''}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-brand-300 transition-colors group-hover:text-white">
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="hidden text-xs font-medium sm:inline">
                        {isBusy ? 'Starting…' : 'Save'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <HardDrive className="h-3 w-3 shrink-0" aria-hidden="true" />
            Your file streams directly from the source server. Only download content you have the
            right to.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
