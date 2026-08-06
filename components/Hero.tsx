import { Downloader } from '@/components/Downloader';

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-40 right-[-120px] h-[320px] w-[320px] rounded-full bg-accent/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          Free · No API keys · No watermark
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          <span className="text-white">Universal </span>
          <span className="text-gradient">Social Media</span>
          <span className="text-white"> Downloader</span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
          Save videos, MP3 audio, and high-resolution images from{' '}
          <span className="font-semibold text-slate-200">YouTube</span>,{' '}
          <span className="font-semibold text-slate-200">Facebook</span>, and{' '}
          <span className="font-semibold text-slate-200">Pinterest</span> — directly to your
          phone or computer in one tap.
        </p>
      </div>

      <Downloader />
    </section>
  );
}
