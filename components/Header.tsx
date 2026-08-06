'use client';

import Link from 'next/link';
import { CloudDownload } from 'lucide-react';
import { PlatformIcon } from '@/components/icons';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#supported-platforms', label: 'Platforms' },
  { href: '#faq', label: 'FAQ' },
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
    href: 'https://facebook.com/riyadsarkar07',
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
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
