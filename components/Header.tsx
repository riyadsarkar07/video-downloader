'use client';

import Link from 'next/link';
import { CloudDownload, Globe } from 'lucide-react';
import { PlatformIcon } from '@/components/icons';
import { useI18n } from '@/lib/i18n';
import { clsx } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'howItWorks' as const },
  { href: '#supported-platforms', label: 'platforms' as const },
  { href: '#faq', label: 'faq' as const },
];

const SOCIAL_LINKS = [
  {
    platform: 'youtube' as const,
    href: 'https://youtube.com/@youare_special07',
    label: 'Riyad on YouTube',
    color: 'text-[#ff0033]',
  },
  {
    platform: 'facebook' as const,
    href: 'https://www.facebook.com/RiyadSarkar007',
    label: 'Riyad on Facebook',
    color: 'text-[#1877f2]',
  },
  {
    platform: 'pinterest' as const,
    href: 'https://pinterest.com/riyadsarkar07',
    label: 'Riyad on Pinterest',
    color: 'text-[#e60023]',
  },
];

export function Header() {
  const { lang, toggleLang, t } = useI18n();

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-surface/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hero-gradient shadow-glow transition-transform duration-300 group-hover:scale-105">
            <CloudDownload className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight text-white">
            Uni<span className="text-gradient">Downloader</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-white">
              {t(link.label)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-300',
              'border-white/10 bg-white/5 text-slate-200 hover:scale-105 hover:border-white/20 hover:bg-white/10',
            )}
            aria-label="Toggle language / ভাষা পরিবর্তন"
            title={lang === 'en' ? 'বাংলায় দেখুন' : 'View in English'}
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{lang === 'en' ? 'EN' : 'বাংলা'}</span>
            <span className="text-slate-500">/</span>
            <span className={lang === 'bn' ? 'text-brand-300' : 'text-slate-400'}>
              {lang === 'en' ? 'বাংলা' : 'EN'}
            </span>
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 sm:flex">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.platform}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                title={social.label}
                className={`transition-all duration-300 hover:scale-125 ${social.color}`}
              >
                <PlatformIcon platform={social.platform} className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
