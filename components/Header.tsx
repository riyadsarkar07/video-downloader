'use client';

import Link from 'next/link';
import { CloudDownload } from 'lucide-react';
import { PlatformIcon } from '@/components/icons';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#supported-platforms', label: 'Platforms' },
  { href: '#faq', label: 'FAQ' },
];

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-surface/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hero-gradient shadow-glow">
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
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 sm:flex">
            <PlatformIcon platform="youtube" className="h-3.5 w-3.5 text-[#ff0033]" />
            <PlatformIcon platform="facebook" className="h-3.5 w-3.5 text-[#1877f2]" />
            <PlatformIcon platform="pinterest" className="h-3.5 w-3.5 text-[#e60023]" />
          </div>
        </div>
      </div>
    </header>
  );
}
