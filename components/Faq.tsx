'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from '@/lib/utils';

const FAQS = [
  {
    question: 'Is this a real downloader?',
    answer:
      'Yes. Metadata and files are processed on a dedicated backend with yt-dlp and FFmpeg. Progress comes from the actual job, not a fake timer.',
  },
  {
    question: 'Why not host downloads on Vercel?',
    answer:
      'Vercel serverless functions have short timeouts and no persistent disk. Video processing needs a long-running Node.js server, which is why the backend is separate.',
  },
  {
    question: 'Which formats can I download?',
    answer:
      'MP4 video at the best available quality plus 1080p, 720p, 480p, and 360p when the source provides them. Audio is exported as MP3 when the source has an audio track.',
  },
  {
    question: 'Why do some videos fail?',
    answer:
      'Private, age-gated, geo-blocked, DRM-protected, or login-required videos cannot be downloaded. YouTube may also block datacenter IPs with a bot check. That is reported honestly and is not bypassed.',
  },
  {
    question: 'Do you store my videos?',
    answer:
      'Temporary files live on the server only while the job is active, then they are deleted automatically. We do not keep a media library.',
  },
  {
    question: 'Can I download copyrighted content?',
    answer:
      'Only download media you own or have permission to save. This tool is for personal backups of public content you are allowed to keep.',
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">FAQ</span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Frequently asked questions</h2>
      </div>
      <div className="mt-10 space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={faq.question} className={clsx('overflow-hidden rounded-2xl border border-line bg-card', isOpen && 'border-brand-400/30')}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold text-ink sm:text-base">{faq.question}</span>
                <ChevronDown className={clsx('h-4 w-4 shrink-0 text-muted transition-transform', isOpen && 'rotate-180 text-brand-500')} />
              </button>
              {isOpen ? <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{faq.answer}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
