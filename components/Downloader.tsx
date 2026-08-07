'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { ClipboardPaste, Link2, Loader2, X, Zap } from 'lucide-react';
import { detectPlatform, PLATFORM_META, PLATFORM_ORDER } from '@/lib/platforms';
import { clsx } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import type { MediaInfo, Platform } from '@/lib/types';
import { PlatformIcon } from '@/components/icons';
import { MediaPreview } from '@/components/MediaPreview';
import { ConfettiBurst } from '@/components/ConfettiBurst';

type DetectionState = 'idle' | 'active' | 'busy' | 'complete' | 'error';

const DETECTION_PULSE: Record<DetectionState, string> = {
  idle: 'text-slate-500',
  active: 'text-accent',
  busy: 'text-slate-500',
  complete: 'text-emerald-400',
  error: 'text-rose-400',
};

export function Downloader() {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [detected, setDetected] = useState<Platform | null>(null);
  const [state, setState] = useState<DetectionState>('idle');
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const platform = detectPlatform(url);
    setDetected(platform);
    if (url.trim() && !platform) {
      setState('idle');
    }
  }, [url]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const startProgress = useCallback(() => {
    setProgress(10);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return current;
        return Math.min(90, current + Math.floor(Math.random() * 9) + 3);
      });
    }, 180);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(100);
  }, []);

  const handlePaste = useCallback(async () => {
    setPasting(true);
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          toast.success(t('linkPasted'));
        } else {
          toast.error(t('clipboardEmpty'));
        }
      } else {
        toast.error(t('clipboardBlocked'));
      }
    } catch {
      toast.error(t('clipboardManual'));
    } finally {
      setPasting(false);
    }
  }, [t]);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setUrl('');
    setDetected(null);
    setInfo(null);
    setError(null);
    setProgress(0);
    setState('idle');
  }, []);

  const handleExtract = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error(t('pasteLinkFirst'));
      return;
    }
    if (!detected) {
      toast.error(t('linkNotSupported'));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setState('busy');
    startProgress();

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        stopProgress();
        setState('error');
        setError(payload.error ?? t('genericError'));
        toast.error(payload.error ?? t('extractionFailed'));
        return;
      }

      stopProgress();
      setInfo(payload.data);
      setState('complete');
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 2200);
      toast.success(t('mediaReady'));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      stopProgress();
      setState('error');
      setError(t('networkError'));
      toast.error(t('serverUnreachable'));
    } finally {
      setLoading(false);
    }
  }, [url, detected, t, startProgress, stopProgress]);

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl px-4 sm:px-6">
      <div className="glass-card glow-card relative overflow-visible p-3 sm:p-5">
        <AnimatePresence>{showConfetti && <ConfettiBurst />}</AnimatePresence>

        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <Link2
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setState('idle');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleExtract();
                }
              }}
              placeholder={t('inputPlaceholder')}
              className="input-base pl-10 pr-20 md:pr-24"
              aria-label="Media link"
            />
            <AnimatePresence>
              {url && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={handleClear}
                  className="absolute right-12 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center p-1.5 hover:bg-slate-800/80 rounded-full text-slate-400 hover:text-white transition md:right-16"
                  aria-label={t('clearInput')}
                  title={t('clearInput')}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={handlePaste}
            disabled={pasting}
            className="btn-ghost shrink-0 px-3 sm:px-4"
            aria-label={t('pasteFromClipboard')}
            title={t('pasteFromClipboard')}
          >
            {pasting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{t('paste')}</span>
          </button>

          <button
            type="button"
            onClick={handleExtract}
            disabled={loading || !url.trim()}
            className="btn-primary shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{loading ? t('extracting') : t('extract')}</span>
          </button>
        </div>

        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-300" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                  {Math.round(progress)}%
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {t('detectedPlatform')}
          </span>
          {PLATFORM_ORDER.map((platform) => {
            const meta = PLATFORM_META[platform];
            const isDetected = detected === platform;
            return (
              <span
                key={platform}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-300',
                  isDetected
                    ? `border-white/20 bg-white/10 text-white shadow-glow ${meta.ring}`
                    : 'border-white/5 bg-white/[0.03] text-slate-500',
                )}
              >
                <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
                {meta.label}
                <span
                  className={clsx(
                    'h-1.5 w-1.5 rounded-full transition-colors',
                    isDetected ? DETECTION_PULSE.active : DETECTION_PULSE.idle,
                  )}
                  aria-hidden="true"
                />
              </span>
            );
          })}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />
                <p>{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {info && <MediaPreview key="preview" info={info} />}
      </AnimatePresence>
    </section>
  );
}
