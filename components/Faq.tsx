'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { clsx } from '@/lib/utils';

const FAQS = [
  {
    question: 'Is this service really free?',
    answer:
      'Yes. Extraction runs entirely inside the app’s own server functions. There are no third-party paid APIs, no API keys, and no hidden costs.',
  },
  {
    question: 'Will the download open in a new tab?',
    answer:
      'No. Every download streams through our proxy route with a strict attachment header, which forces your browser to open the native “Save File” dialog immediately — on both desktop and mobile.',
  },
  {
    question: 'Which formats can I download?',
    answer:
      'YouTube: MP4 video (up to available progressive quality) and MP3 audio. Facebook: HD/SD MP4 video. Pinterest: MP4 video pins and full-resolution JPG images.',
  },
  {
    question: 'Why is 1080p not always available on YouTube?',
    answer:
      'YouTube serves 1080p+ as separate video and audio streams that require server-side merging. Since we run on stateless serverless functions with zero external APIs, we expose the best combined (progressive) formats plus MP3 audio.',
  },
  {
    question: 'What if the link is private or deleted?',
    answer:
      'The parser will return a clear, friendly error message. We only support public content that is legally shareable — please respect creators’ rights.',
  },
  {
    question: 'Is my data stored anywhere?',
    answer:
      'No. Links are processed in-memory and immediately discarded. We never log, store, or share the content you download.',
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
          FAQ
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Frequently asked questions
        </h2>
      </div>

      <div className="mt-10 space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={faq.question}
              className={clsx(
                'glass-card overflow-hidden transition-colors',
                isOpen && 'border-white/20',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold text-white sm:text-base">
                  {faq.question}
                </span>
                <ChevronDown
                  className={clsx(
                    'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300',
                    isOpen && 'rotate-180 text-brand-300',
                  )}
                  aria-hidden="true"
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
