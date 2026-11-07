'use client';

import { Downloader } from '@/components/Downloader';

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-16 sm:pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-1.5 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Real downloads · yt-dlp engine · No fake progress
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold tracking-tight text-ink sm:text-6xl">
          Download videos
          <span className="block text-brand-500">the professional way</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
          Paste a public video link. We extract real metadata, let you pick quality, then process the file on the server and send it to your browser.
        </p>
      </div>
      <div className="mt-10">
        <Downloader />
      </div>
    </section>
  );
}
