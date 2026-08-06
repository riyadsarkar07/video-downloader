import Link from 'next/link';
import { Github, ShieldCheck } from 'lucide-react';
import { PlatformIcon } from '@/components/icons';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-white">Universal Media Downloader</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
              A fast, privacy-friendly, zero-cost downloader for YouTube, Facebook, and Pinterest
              content.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Supported Platforms</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <PlatformIcon platform="youtube" className="h-3.5 w-3.5 text-[#ff0033]" /> Videos &amp; MP3
              </li>
              <li className="flex items-center gap-2">
                <PlatformIcon platform="facebook" className="h-3.5 w-3.5 text-[#1877f2]" /> Videos
              </li>
              <li className="flex items-center gap-2">
                <PlatformIcon platform="pinterest" className="h-3.5 w-3.5 text-[#e60023]" /> Videos &amp; Images
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Resources</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-400">
              <li>
                <Link href="/privacy" className="transition-colors hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} UniDownloader. Download responsibly.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              No data stored, ever
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
            >
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              Source
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
