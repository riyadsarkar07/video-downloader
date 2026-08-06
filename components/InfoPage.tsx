interface LegalSection {
  heading: string;
  body: string;
}

interface InfoPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}

export function InfoPage({ eyebrow, title, intro, sections }: InfoPageProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
        {eyebrow}
      </span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-400">{intro}</p>

      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-white">{section.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
