import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-line bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-ink">UniDown</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
              A real video downloader with server-side processing, quality selection, and honest limits.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Supported</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              <li>Direct public media URLs</li>
              <li>Public Facebook / TikTok when reachable</li>
              <li>YouTube, X, Reddit, Instagram if the source allows it</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Resources</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              <li>
                <Link href="/privacy" className="hover:text-ink">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-ink">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-ink">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Temporary files only. No DRM bypass.
          </span>
          <p>© {new Date().getFullYear()} UniDown</p>
        </div>
      </div>
    </footer>
  );
}
