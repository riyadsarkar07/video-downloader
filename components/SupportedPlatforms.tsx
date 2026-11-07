import { Check } from 'lucide-react';
import { PlatformIcon } from '@/components/icons';
import type { Platform } from '@/lib/types';

const PLATFORMS: Array<{ id: Platform; name: string; features: string[] }> = [
  { id: 'youtube', name: 'YouTube', features: ['Public videos via yt-dlp', 'May fail from datacenter IPs', 'BOT_CHECK is reported honestly'] },
  { id: 'facebook', name: 'Facebook', features: ['Public videos when reachable', 'Quality selection', 'No login wall bypass'] },
  { id: 'instagram', name: 'Instagram', features: ['Public Reels and posts if reachable', 'Login walls are not bypassed', 'Clear error if blocked'] },
  { id: 'tiktok', name: 'TikTok', features: ['Public videos when the extractor works', 'MP4 and MP3 when available', 'No DRM bypass'] },
  { id: 'twitter', name: 'X', features: ['Public video posts if reachable', 'Protected accounts rejected', 'No CAPTCHA bypass'] },
  { id: 'reddit', name: 'Reddit', features: ['Public videos if the source allows it', 'Often requires a session', 'Auth walls are not bypassed'] },
  { id: 'vimeo', name: 'Vimeo', features: ['Public Vimeo videos', 'Login-only videos rejected', 'MP4 when available'] },
];

export function SupportedPlatforms() {
  return (
    <section id="supported-platforms" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Coverage</span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Built for public video links</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted sm:text-base">
          Reliable extractors first. We never bypass DRM, logins, or paywalls.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <div key={platform.id} className="rounded-2xl border border-line bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface">
                <PlatformIcon platform={platform.id} className="h-6 w-6 text-ink" />
              </span>
              <h3 className="text-lg font-bold text-ink">{platform.name}</h3>
            </div>
            <ul className="mt-6 space-y-3">
              {platform.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm text-muted">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                    <Check className="h-3 w-3" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
