'use client';

import Link from 'next/link';
import { CloudDownload, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { clsx } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#supported-platforms', label: 'Platforms' },
  { href: '#faq', label: 'FAQ' },
];

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-glow">
            <CloudDownload className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">
            Uni<span className="text-brand-500">Down</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          className={clsx(
            'inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-ink',
            'transition hover:border-brand-400/40 hover:text-brand-500',
          )}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
