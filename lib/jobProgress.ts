import type { DownloadJob } from '@/lib/types';

export type JobStatus = DownloadJob['status'];
export type JobNotice = 'ready' | 'failed' | null;

export const TERMINAL_STATUSES: readonly JobStatus[] = ['ready', 'failed', 'expired'];

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface JobTransition {
  stopPolling: boolean;
  clearBusy: boolean;
  notice: JobNotice;
}

export function jobTransition(previous: JobStatus | null, next: DownloadJob): JobTransition {
  if (next.status === 'ready') {
    return {
      stopPolling: true,
      clearBusy: previous !== 'ready',
      notice: previous === 'ready' ? null : 'ready',
    };
  }
  if (next.status === 'failed' || next.status === 'expired') {
    return {
      stopPolling: true,
      clearBusy: true,
      notice: previous === next.status && previous !== null ? null : 'failed',
    };
  }
  return { stopPolling: false, clearBusy: false, notice: null };
}

export function progressPercent(job: Pick<DownloadJob, 'progress'>): number {
  const value = Number(job.progress);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function canCancel(job: Pick<DownloadJob, 'status'>): boolean {
  return job.status === 'queued' || job.status === 'processing';
}
