'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Clock,
  Download,
  FilePenLine,
  Film,
  Loader2,
  Music,
  Square,
  User,
} from 'lucide-react';
import { PLATFORM_META } from '@/lib/platforms';
import { clsx, formatBytes, formatDuration, sanitizeFilename } from '@/lib/utils';
import type { DownloadJob, MediaFormat, MediaInfo } from '@/lib/types';
import { PlatformIcon } from '@/components/icons';

interface MediaPreviewProps {
  info: MediaInfo;
  sourceUrl: string;
}

const STAGE_LABEL: Record<string, string> = {
  queued: 'Queued on the server',
  starting: 'Starting yt-dlp…',
  downloading: 'Downloading from source…',
  processing: 'Merging with FFmpeg…',
  ready: 'File ready',
  failed: 'Failed',
};

export function MediaPreview({ info, sourceUrl }: MediaPreviewProps) {
  const [customFilename, setCustomFilename] = useState('');
  const [selectedId, setSelectedId] = useState(info.formats[0]?.id ?? '');
  const [job, setJob] = useState<DownloadJob | null>(null);
  const [busy, setBusy] = useState(false);
  const platform = (info.platform in PLATFORM_META ? info.platform : 'generic') as keyof typeof PLATFORM_META;
  const meta = PLATFORM_META[platform];
  const selected = info.formats.find((format) => format.id === selectedId) ?? info.formats[0];

  useEffect(() => {
    if (!job || job.status === 'ready' || job.status === 'failed') return undefined;
    const id = job.id;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`);
        const payload = await response.json();
        if (payload.success && payload.job) {
          const next: DownloadJob = payload.job;
          setJob(next);
          if (next.status === 'failed') {
            toast.error(next.error || 'Download failed');
            setBusy(false);
          }
          if (next.status === 'ready') {
            setBusy(false);
            toast.success('Your file is ready');
          }
        }
      } catch {
        /* keep polling */
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  const startDownload = async () => {
    if (!selected) return;
    setBusy(true);
    setJob(null);
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sourceUrl,
          formatId: selected.id,
          filename: customFilename.trim() || info.filenameBase || info.title,
          title: info.title,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        toast.error(payload.error ?? 'Could not start the download');
        setBusy(false);
        return;
      }
      setJob(payload.job);
    } catch {
      toast.error('Could not reach the download server');
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      <div className="grid gap-0 md:grid-cols-[minmax(0,340px)_1fr]">
        <div className="relative aspect-video bg-line md:aspect-auto md:min-h-[240px]">
          {info.thumbnail ? (
            <img
              src={info.thumbnail}
              alt={info.title}
              referrerPolicy="no-referrer"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="h-12 w-12 text-muted" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
              <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
              {meta.label}
            </span>
            {info.duration ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                <Clock className="h-3 w-3" />
                {formatDuration(info.duration)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col p-5 sm:p-6">
          <h3 className="text-lg font-semibold leading-snug text-ink">{info.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
            {info.author ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {info.author}
              </span>
            ) : null}
            {info.duration ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(info.duration)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" />
              {info.formats.length} formats
            </span>
          </div>

          <label className="mt-5 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
              <FilePenLine className="h-3.5 w-3.5" />
              Filename (optional)
            </span>
            <input
              type="text"
              value={customFilename}
              onChange={(event) => setCustomFilename(event.target.value)}
              placeholder={sanitizeFilename(info.title)}
              className="input-base"
            />
          </label>

          <div className="mt-5" role="radiogroup" aria-label="Quality and format">
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted">Quality & format</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {info.formats.map((format) => (
                <FormatButton
                  key={format.id}
                  format={format}
                  active={selected?.id === format.id}
                  onSelect={() => setSelectedId(format.id)}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void startDownload()}
            disabled={busy || !selected}
            className="btn-primary mt-5 w-full"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? 'Processing on the server…' : `Download ${selected?.label ?? ''}`}
          </button>

          {job ? (
            <JobStatus
              job={job}
              onCancel={async () => {
                setBusy(false);
                setJob({ ...job, status: 'failed', error: 'Cancelled' });
                try {
                  const response = await fetch(`/api/jobs/${job.id}/cancel`, { method: 'POST' });
                  const payload = await response.json();
                  if (payload.job) setJob(payload.job);
                  toast.success('Download cancelled');
                } catch {
                  toast.error('Could not cancel the download');
                }
              }}
            />
          ) : null}

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Only download content you have the right to save. DRM, private, and paywalled videos are not supported.
          </p>
        </div>
      </div>
    </div>
  );
}

function FormatButton({
  format,
  active,
  onSelect,
}: {
  format: MediaFormat;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = format.kind === 'audio' ? Music : Film;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={clsx(
        'flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
        active ? 'border-brand-400 bg-brand-500/10' : 'border-line hover:border-brand-400/40',
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-line text-ink">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink">{format.label}</span>
        <span className="block text-xs text-muted">
          {format.quality}
          {format.filesize ? ` · ${formatBytes(format.filesize)}` : ''}
          {` · ${format.ext.toUpperCase()}`}
        </span>
      </span>
    </button>
  );
}

function JobStatus({ job, onCancel }: { job: DownloadJob; onCancel: () => void }) {
  const ready = job.status === 'ready';
  const failed = job.status === 'failed';
  const live = job.status === 'queued' || job.status === 'processing';
  return (
    <div className="mt-5 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          {ready ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
          {STAGE_LABEL[job.stage] || STAGE_LABEL[job.status] || 'Working…'}
        </p>
        <span className="text-xs tabular-nums text-muted">{Math.round(job.progress)}%</span>
      </div>
      <div
        className="progress-track mt-3"
        role="progressbar"
        aria-label="Download progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(job.progress)}
      >
        <div className="progress-fill" style={{ width: `${Math.max(4, job.progress)}%` }} />
      </div>
      {failed ? (
        <p role="alert" className="mt-3 text-sm text-rose-500">
          {job.error}
        </p>
      ) : null}
      {live ? (
        <button type="button" onClick={onCancel} className="btn-ghost mt-4 w-full">
          <Square className="h-3.5 w-3.5" />
          Cancel processing
        </button>
      ) : null}
      {ready ? (
        <a
          href={`/api/jobs/${job.id}/file`}
          download={job.filename || undefined}
          className="btn-primary mt-4 inline-flex w-full"
        >
          <Download className="h-4 w-4" />
          Save {job.filename || 'file'} to device
          {job.filesize ? ` · ${formatBytes(job.filesize)}` : ''}
        </a>
      ) : null}
    </div>
  );
}
