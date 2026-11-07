import { ClipboardPaste, Cpu, Download } from 'lucide-react';

const STEPS = [
  {
    icon: ClipboardPaste,
    step: '01',
    title: 'Paste a public URL',
    desc: 'We validate the link, detect the platform, and reject private or unsafe addresses.',
  },
  {
    icon: Cpu,
    step: '02',
    title: 'Inspect real metadata',
    desc: 'The server uses yt-dlp to read title, duration, thumbnail, and available qualities.',
  },
  {
    icon: Download,
    step: '03',
    title: 'Process, then download',
    desc: 'A background job fetches and merges streams. Your browser then receives the actual file.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-line bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Workflow</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">From URL to a real file</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.step} className="rounded-2xl border border-line bg-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white">
                <step.icon className="h-5 w-5" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">{step.step}</p>
              <h3 className="mt-1 text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
