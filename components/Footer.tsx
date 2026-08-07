'use client';

import Link from 'next/link';
import { Heart, ShieldCheck } from 'lucide-react';
import { PlatformIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import type { DictKey } from '@/lib/i18n';
import type { Platform } from '@/lib/types';

const SOCIAL_LINKS = [
  {
    platform: 'youtube' as const,
    href: 'https://youtube.com/@youare_special07',
    label: 'Riyad on YouTube',
    color: 'text-[#ff0033] hover:bg-[#ff0033]/10 hover:text-[#ff0033]',
  },
  {
    platform: 'facebook' as const,
    href: 'https://www.facebook.com/RiyadSarkar007',
    label: 'Riyad on Facebook',
    color: 'text-[#1877f2] hover:bg-[#1877f2]/10 hover:text-[#1877f2]',
  },
  {
    platform: 'pinterest' as const,
    href: 'https://pinterest.com/riyadsarkar07',
    label: 'Riyad on Pinterest',
    color: 'text-[#e60023] hover:bg-[#e60023]/10 hover:text-[#e60023]',
  },
];

const SUPPORTED: Array<{ platform: Platform; color: string; labelKey: DictKey }> = [
  { platform: 'youtube', color: 'text-[#ff0033]', labelKey: 'footerPlatformYt' },
  { platform: 'facebook', color: 'text-[#1877f2]', labelKey: 'footerPlatformFb' },
  { platform: 'instagram', color: 'text-[#e4405f]', labelKey: 'footerPlatformIg' },
  { platform: 'tiktok', color: 'text-[#25f4ee]', labelKey: 'footerPlatformTt' },
  { platform: 'twitter', color: 'text-[#1d9bf0]', labelKey: 'footerPlatformX' },
  { platform: 'threads', color: 'text-slate-200', labelKey: 'footerPlatformTh' },
  { platform: 'pinterest', color: 'text-[#e60023]', labelKey: 'footerPlatformPin' },
];

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-white/5 bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-white">Universal Media Downloader</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
              {t('footerTagline')}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.platform}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all duration-300 hover:scale-110 ${social.color}`}
                >
                  <PlatformIcon platform={social.platform} className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">{t('footerSupported')}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
              {SUPPORTED.map((item) => (
                <li key={item.platform} className="flex items-center gap-2">
                  <PlatformIcon platform={item.platform} className={`h-3.5 w-3.5 ${item.color}`} />
                  {t(item.labelKey)}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">{t('footerResources')}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
              <li>
                <Link href="/privacy" className="transition-colors hover:text-white">
                  {t('footerPrivacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  {t('footerTerms')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white">
                  {t('footerContact')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-slate-500 sm:flex-row">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            {t('footerNoData')}
          </span>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300">
            {t('footerDesigned')}
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-label="love" />
            {t('footerBy')}
            <span className="text-slate-600">|</span>
            {t('footerRights')}
          </p>
          <p className="text-slate-500">© {new Date().getFullYear()} UniDownloader</p>
        </div>
      </div>
    </footer>
  );
}
