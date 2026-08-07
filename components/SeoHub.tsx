'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenText, ChevronDown, ShieldCheck } from 'lucide-react';
import { clsx } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import type { DictKey } from '@/lib/i18n';
import type { Platform } from '@/lib/types';
import { PlatformIcon } from '@/components/icons';

const GUIDES: Array<{ platform: Platform; titleKey: DictKey; textKey: DictKey }> = [
  { platform: 'facebook', titleKey: 'seoGuideFbReels', textKey: 'seoGuideFbReelsText' },
  { platform: 'tiktok', titleKey: 'seoGuideTiktok', textKey: 'seoGuideTiktokText' },
  { platform: 'pinterest', titleKey: 'seoGuidePinterest', textKey: 'seoGuidePinterestText' },
  { platform: 'instagram', titleKey: 'seoGuideInstagram', textKey: 'seoGuideInstagramText' },
  { platform: 'twitter', titleKey: 'seoGuideX', textKey: 'seoGuideXText' },
  { platform: 'threads', titleKey: 'seoGuideThreads', textKey: 'seoGuideThreadsText' },
  { platform: 'youtube', titleKey: 'seoGuideYoutube', textKey: 'seoGuideYoutubeText' },
];

export function SeoHub() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="seo-guides" className="border-t border-white/5 bg-surface-soft/40">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
            <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
            {t('seoBadge')}
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('seoTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400 sm:text-base">
            {t('seoSubtitle')}
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {GUIDES.map((guide, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={guide.titleKey}
                className={clsx(
                  'glass-card overflow-hidden transition-colors',
                  isOpen && 'border-white/20',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <PlatformIcon platform={guide.platform} className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-white sm:text-base">
                      {t(guide.titleKey)}
                    </span>
                  </span>
                  <ChevronDown
                    className={clsx(
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300',
                      isOpen && 'rotate-180 text-brand-300',
                    )}
                    aria-hidden="true"
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pl-[3.25rem]">
                        <p className="text-sm leading-relaxed text-slate-400">
                          {t(guide.textKey)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-8 flex max-w-xl items-start justify-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-5 py-4 text-left">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-slate-300">{t('seoLegalNote')}</p>
        </div>
      </div>
    </section>
  );
}
