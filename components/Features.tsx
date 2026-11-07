import { Gauge, Lock, Server, ShieldCheck, Timer, Waves } from 'lucide-react';

const FEATURES = [
  {
    icon: Server,
    title: 'Dedicated processing server',
    desc: 'yt-dlp and FFmpeg run on a Node.js backend, not inside a 10-second serverless function.',
  },
  {
    icon: Gauge,
    title: 'Real quality options',
    desc: 'Choose best available, 1080p, 720p, 480p, 360p, or MP3 when the source actually provides them.',
  },
  {
    icon: Timer,
    title: 'Honest job progress',
    desc: 'Status comes from the download job itself: queued, downloading, merging, then ready.',
  },
  {
    icon: ShieldCheck,
    title: 'SSRF and rate limits',
    desc: 'Private IPs, localhost, and metadata hosts are blocked. Requests are rate-limited.',
  },
  {
    icon: Waves,
    title: 'Streamed file delivery',
    desc: 'When the file is ready, it streams to your browser as a real attachment.',
  },
  {
    icon: Lock,
    title: 'No DRM or paywall bypass',
    desc: 'Private, login-required, and DRM-protected media are rejected with a clear error.',
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Features</span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Built like a product, not a demo</h2>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-line bg-card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <feature.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-5 text-lg font-bold text-ink">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{feature.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
