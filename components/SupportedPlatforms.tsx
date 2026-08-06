import { Check, Minus } from 'lucide-react';
import { PlatformIcon } from '@/components/icons';
import { clsx } from '@/lib/utils';

interface PlatformFeature {
  label: string;
  supported: boolean;
}

const PLATFORMS: Array<{
  id: 'youtube' | 'facebook' | 'pinterest';
  name: string;
  color: string;
  features: PlatformFeature[];
}> = [
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'text-[#ff0033]',
    features: [
      { label: 'HD video download', supported: true },
      { label: 'MP3 audio extraction', supported: true },
      { label: 'Shorts & Live support', supported: true },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: 'text-[#1877f2]',
    features: [
      { label: 'Reels & video download', supported: true },
      { label: 'HD & SD streams', supported: true },
      { label: 'Public post support', supported: true },
    ],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    color: 'text-[#e60023]',
    features: [
      { label: 'HD video pins', supported: true },
      { label: 'Full-res image download', supported: true },
      { label: 'Preview-size export', supported: true },
    ],
  },
];

export function SupportedPlatforms() {
  return (
    <section id="supported-platforms" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
          Supported platforms
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Three platforms. One downloader.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400 sm:text-base">
          Purpose-built native parsers for each platform — no third-party services in between.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className="group glass-card relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-glow"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-25"
              style={{ backgroundColor: 'currentColor' }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <PlatformIcon platform={platform.id} className={clsx('h-6 w-6', platform.color)} />
              </span>
              <h3 className="text-lg font-bold text-white">{platform.name}</h3>
            </div>

            <ul className="mt-6 space-y-3">
              {platform.features.map((feature) => (
                <li key={feature.label} className="flex items-center gap-2.5 text-sm">
                  {feature.supported ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5 text-slate-600">
                      <Minus className="h-3 w-3" aria-hidden="true" />
                    </span>
                  )}
                  <span className={feature.supported ? 'text-slate-300' : 'text-slate-600'}>
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
