'use client';

import { Downloader } from '@/components/Downloader';
import { ParticleField } from '@/components/ParticleField';
import { useI18n } from '@/lib/i18n';

export function Hero() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
      <div className="ambient-orb h-[420px] w-[640px] bg-brand-600/25" style={{ top: -140, left: '50%', marginLeft: -320, animation: 'float-a 18s ease-in-out infinite' }} aria-hidden="true" />
      <div className="ambient-orb h-[280px] w-[280px] bg-accent/20" style={{ top: 160, right: -80, animation: 'float-b 22s ease-in-out infinite' }} aria-hidden="true" />
      <div className="ambient-orb h-[260px] w-[360px] bg-fuchsia-600/15" style={{ top: 320, left: -120, animation: 'float-c 26s ease-in-out infinite' }} aria-hidden="true" />

      <ParticleField className="z-0" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          {t('heroBadge')}
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          <span className="text-white">{t('heroTitle1')} </span>
          <span className="text-gradient">{t('heroTitle2')}</span>
          <span className="text-white"> {t('heroTitle3')}</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
          {t('heroSubtitle')}
        </p>
      </div>

      <Downloader />
    </section>
  );
}
