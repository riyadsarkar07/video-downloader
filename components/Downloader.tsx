'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardPaste, Link2, Loader2, X, Search } from 'lucide-react';
import { cleanInputUrl, detectPlatform, PLATFORM_META, PLATFORM_ORDER } from '@/lib/platforms';
import { clsx } from '@/lib/utils';
import type { MediaInfo, Platform } from '@/lib/types';
import { PlatformIcon } from '@/components/icons';
import { MediaPreview } from '@/components/MediaPreview';

export function Downloader() {
  const [url, setUrl] = useState('');
  const [detected, setDetected] = useState<Platform | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setDetected(detectPlatform(url));
  }, [url]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handlePaste = useCallback(async () => {
    setPasting(true);
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
          toast.success('Link pasted');
        } else {
          toast.error('Clipboard is empty');
        }
      } else {
        toast.error('Clipboard access is blocked');
      }
    } catch {
      toast.error('Paste the URL manually');
    } finally {
      setPasting(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setUrl('');
    setDetected(null);
    setInfo(null);
    setError(null);
  }, []);

  const handleExtract = useCallback(async () => {
    const trimmed = cleanInputUrl(url) || url.trim();
    if (!trimmed) {
      toast.error('Please paste a link first');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setError('That does not look like a valid URL.');
      toast.error('That does not look like a valid URL.');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setError('Only http and https links are supported.');
      toast.error('Only http and https links are supported.');
      return;
    }
    setUrl(trimmed);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        const message = payload.error ?? 'Could not fetch this video';
        setError(message);
        toast.error(payload.code === 'BOT_CHECK' ? 'Source blocked this server' : message);
        return;
      }
      setInfo(payload.data);
      toast.success('Video ready — choose a format');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError('Could not reach the download server');
      toast.error('Could not reach the download server');
    } finally {
      setLoading(false);
    }
  }, [url]);

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl px-4 sm:px-6">
      <div className="rounded-2xl border border-line bg-card p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative flex-1">
            <Link2
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleExtract();
                }
              }}
              placeholder="Paste a public video URL (YouTube, TikTok, Facebook, Instagram, X, Reddit, Vimeo, or a direct MP4)…"
              className="input-base pl-10 pr-12"
              aria-label="Video URL"
            />
            {url ? (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-line hover:text-ink"
                aria-label="Clear input"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handlePaste} disabled={pasting} className="btn-ghost flex-1 px-3 sm:flex-none sm:px-4">
              {pasting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
              <span>Paste</span>
            </button>
            <button type="button" onClick={handleExtract} disabled={loading || !url.trim()} className="btn-primary flex-1 sm:flex-none">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>{loading ? 'Fetching…' : 'Fetch video'}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-3 px-1">
            <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
            <p className="text-sm text-muted">Reading video metadata from the source…</p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Detected</span>
          {PLATFORM_ORDER.map((platform) => {
            const meta = PLATFORM_META[platform];
            const isDetected = detected === platform;
            return (
              <span
                key={platform}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                  isDetected ? 'border-brand-400/40 bg-brand-500/10 text-ink' : 'border-line bg-transparent text-muted',
                )}
              >
                <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
                {meta.label}
              </span>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
            {error}
          </div>
        ) : null}
      </div>

      {info ? <MediaPreview info={info} sourceUrl={url} /> : null}
    </section>
  );
}
