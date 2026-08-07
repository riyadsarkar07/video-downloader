'use client';

import { ClipboardPaste, Cpu, Download, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

const STEPS = [
  { icon: ClipboardPaste, step: '01', titleKey: 'step1Title' as const, descKey: 'step1Desc' as const },
  { icon: Cpu, step: '02', titleKey: 'step2Title' as const, descKey: 'step2Desc' as const },
  { icon: Download, step: '03', titleKey: 'step3Title' as const, descKey: 'step3Desc' as const },
];

export function HowItWorks() {
  const { t } = useI18n();

  return (
    <section id="how-it-works" className="border-y border-white/5 bg-surface-soft/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
            {t('howItWorksBadge')}
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('howItWorksTitle')}
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.step} className="relative">
              <div className="glass-card relative h-full p-6">
                <span className="absolute right-5 top-5 text-4xl font-black text-white/5">
                  {step.step}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-hero-gradient shadow-glow">
                  <step.icon className="h-5 w-5 text-white" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-white">{t(step.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(step.descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-3 rounded-2xl border border-brand-400/20 bg-brand-500/5 px-5 py-4 text-center">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
          <p className="text-sm text-slate-300">{t('howItWorksNote')}</p>
        </div>
      </div>
    </section>
  );
}
