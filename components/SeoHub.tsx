const NOTES = [
  {
    title: 'YouTube videos and MP3',
    body: 'Public YouTube links are sent to yt-dlp. Datacenter IPs are often blocked with a bot check. We report that error instead of faking success.',
  },
  {
    title: 'Public TikTok videos',
    body: 'Paste a public TikTok URL. The server processes the video and returns an MP4 file.',
  },
  {
    title: 'Public Facebook videos',
    body: 'Public Reels and videos can be fetched. Private or login-only posts will fail with a clear error.',
  },
  {
    title: 'Public Instagram media',
    body: 'Public Reels and posts may work. Stories, private accounts, and login walls are not bypassed.',
  },
  {
    title: 'Public X videos',
    body: 'Public video posts can be processed. Protected accounts and DRM streams are rejected.',
  },
  {
    title: 'Reddit, Vimeo, and direct URLs',
    body: 'Public Reddit, Vimeo, and recognized direct media URLs use the same yt-dlp pipeline.',
  },
];

export function SeoHub() {
  return (
    <section className="border-t border-line bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Notes</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">What this tool will and will not do</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted">Clear limits keep the downloader reliable and lawful.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {NOTES.map((note) => (
            <article key={note.title} className="rounded-2xl border border-line bg-card p-5">
              <h3 className="text-base font-semibold text-ink">{note.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{note.body}</p>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted">
          Respect creators, platform terms, and copyright law. We do not bypass DRM or authentication.
        </p>
      </div>
    </section>
  );
}
