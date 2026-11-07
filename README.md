# UniDown

A real video downloader with a Next.js frontend and a dedicated Node.js backend.

This is not a demo UI. Metadata extraction and file processing run on the server with **yt-dlp** and **FFmpeg**. The browser receives an actual MP4 or MP3 file.

## Why the backend is separate

The previous app ran extraction inside Vercel serverless routes and then asked the browser to fetch third-party media URLs. That design fails in production:

- Vercel functions have short timeouts and no persistent disk.
- `@distube/ytdl-core` and HTML scraping break often.
- Cobalt / Invidious fallbacks are third-party services, not a local downloader.
- Direct CDN URLs expire or refuse hotlinking, so the "download" button did not save a real file.

UniDown splits the work:

| Piece | Where it runs | Role |
| --- | --- | --- |
| Frontend | Vercel or `next dev` | UI, URL input, quality picker, job progress |
| Backend | Long-running Node.js server | Validate URL, extract metadata, process file, stream download |
| Engine | `yt-dlp` + `ffmpeg` | Public media extraction, merge, MP3 export |

## Supported sources

Public content only. DRM, private accounts, paywalls, CAPTCHAs, and login walls are not bypassed.

A platform is listed as **verified** only if extract + file download succeeded in this environment.

| Source | Status in this environment | Notes |
| --- | --- | --- |
| Direct public MP4 | Verified | Sample MP4 and W3Schools `mov_bbb.mp4` downloaded as real `video/mp4`. MP3 export produced `audio/mpeg`. |
| Facebook public video | Verified | Extract + MP4 download succeeded (`ftypisom`, 5.3 MB). |
| TikTok public video | Verified | Extract + MP4 download succeeded (`ftypisom`, 2.0 MB). |
| YouTube | Blocked (`BOT_CHECK`) | yt-dlp 2026.10.26, all tested player clients: `Sign in to confirm you’re not a bot`. Datacenter IP reputation. Not bypassed. |
| Instagram | Auth required | Extractor asked for a logged-in session. Not bypassed. |
| Reddit | Auth required | Extractor asked for a logged-in session. Not bypassed. |
| Vimeo | Auth required | Public extract failed without login. Not bypassed. |
| X | Not verified | Test tweet had no video (`No video could be found in this tweet`). |

If a source later allows anonymous yt-dlp access, the same job pipeline will process it. Do not advertise YouTube as working until a real file download succeeds.

## Local development

### Requirements

- Node.js 18.17+
- Python 3
- `yt-dlp`
- `ffmpeg`

```bash
# Debian / Ubuntu
sudo apt-get install -y ffmpeg python3-pip
pip3 install -U yt-dlp
```

### Install and run

```bash
# Frontend dependencies
npm install

# Backend dependencies
npm install --prefix backend

# Make the startup script executable once
chmod +x start.sh

# Start backend + frontend together
./start.sh
```

The frontend listens on port `3000` and proxies `/api/*` to the backend on port `3001`.

You can also run the two processes yourself:

```bash
# Terminal 1
npm --prefix backend start

# Terminal 2
BACKEND_URL=http://127.0.0.1:3001 npm run dev
```

## How a download works

1. Paste a public URL.
2. `POST /api/extract` validates the URL, blocks private IPs, and asks yt-dlp for metadata.
3. The UI shows title, thumbnail, duration, and available qualities.
4. Choose MP4 quality or MP3.
5. `POST /api/download` creates a job.
6. `GET /api/jobs/:id` reports real progress from yt-dlp.
7. When status is `ready`, `GET /api/jobs/:id/file` streams the processed file.

Temporary files are deleted automatically.

## API

### `POST /api/extract`

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

### `POST /api/download`

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "formatId": "video-720",
  "filename": "my-video"
}
```

`formatId` values: `video-best`, `video-1080`, `video-720`, `video-480`, `video-360`, `audio-mp3`.

### `GET /api/jobs/:id`

Job status, progress, and error message.

### `GET /api/jobs/:id/file`

Streams the processed file with `Content-Disposition: attachment`.

### `POST /api/jobs/:id/cancel`

Stops a queued or processing job and deletes its temp files.

### `GET /api/health`

Backend health check, including `yt-dlp` / `ffmpeg` versions and whether `YTDLP_COOKIES` is set (boolean only).

## Environment variables

Copy `.env.example`.

Frontend:

- `BACKEND_URL` — backend origin used by Next.js rewrites. Default `http://127.0.0.1:3001`.

Backend:

- `PORT` — default `3001`
- `HOST` — bind address, default `0.0.0.0`
- `TRUST_PROXY` — trusted proxies for `X-Forwarded-For`: hop count, `loopback` (default), or `false` if the API is exposed directly to clients
- `CORS_ORIGINS` — comma-separated browser origins allowed cross-origin. Empty (default) allows same-origin only.
- `YTDLP_BIN` — default `yt-dlp`
- `FFMPEG_BIN` — default `ffmpeg`
- `YTDLP_COOKIES` — optional Netscape cookies file for sites that block anonymous access
- `DOWNLOAD_TMP_DIR` — optional temp directory
- `EXTRACT_TIMEOUT_MS` — default `45000`
- `DOWNLOAD_TIMEOUT_MS` — default `300000`
- `JOB_TTL_MS` — default `900000`
- `MAX_CONCURRENT_JOBS` — default `2`
- `MAX_QUEUED_JOBS` — default `40`; extra jobs get `429 QUEUE_FULL`
- `MAX_FILESIZE` — default `500M`
- `MAX_DURATION_SEC` — default `10800`

Never commit cookies or secrets.

## Production deployment

Do **not** run yt-dlp inside Vercel serverless functions.

### Frontend on Vercel

1. Deploy the Next.js app.
2. Set `BACKEND_URL` to your public backend URL, for example `https://api.example.com`.
3. `next.config.js` rewrites `/api/:path*` to that backend.

### Backend on a VPS or container host

Use any host that can run Node, yt-dlp, and FFmpeg: Railway, Render, Fly.io, a VPS, or Docker.

```bash
cd backend
npm install --omit=dev
PORT=3001 node src/index.js
```

Docker:

```bash
docker build -t unidown-api ./backend
docker run --rm -p 3001:3001 unidown-api
```

Put TLS in front of the API and keep `/api/jobs/:id/file` on a host that allows long responses.

### Production checklist

- Run the API as a non-root user with a read-only filesystem except `DOWNLOAD_TMP_DIR`.
- Set `MAX_CONCURRENT_JOBS`, `MAX_QUEUED_JOBS`, `MAX_FILESIZE`, and `MAX_DURATION_SEC` for your host's CPU, disk, and bandwidth.
- Terminate TLS in front of the backend and set `TRUST_PROXY` to the number of proxy hops so per-IP rate limits see the real client. Leave the default `loopback` when the bundled Next.js proxy forwards `/api`.
- Mount a persistent `DOWNLOAD_TMP_DIR` with enough disk for concurrent downloads; files are removed after `JOB_TTL_MS`.
- Keep `CORS_ORIGINS` empty when the frontend proxies `/api`; set it only when the browser calls the backend origin directly.
- Health check: `GET /api/health` returns engine versions and cookie status (boolean only).
- If the frontend is on Vercel and the backend elsewhere, remember Vercel proxy routes have their own response timeouts. Large or slow files should be requested directly from the backend origin or through a host that permits long-lived responses.

### YouTube bot check

YouTube currently blocks this server with `BOT_CHECK`. That is IP reputation / anti-bot, not a missing extractor flag.

- yt-dlp `2026.10.26` was used.
- Android, iOS, TV, web, and embedded clients all returned the same sign-in / bot message.
- Browser impersonation (`curl_cffi`) is not installed and is not required for other verified sources.
- This app never asks users for cookies and never reads a personal browser profile.

A **server operator** may optionally mount a Netscape cookies file they already control and set `YTDLP_COOKIES`. That is an operations setting, not an end-user login bypass. Do not use it to access private, age-gated, or other people's accounts.

### Cookies

Optional. Export in Netscape format, store the file on the server, and set `YTDLP_COOKIES`. Never commit cookies or secrets.

## Security

- HTTP/HTTPS only
- DNS resolution and private-IP blocking
- Localhost and cloud metadata hosts blocked
- Rate limits on extract and download
- Safe filenames
- File size and duration caps
- Automatic temp-file cleanup
- User URLs are never passed to a shell

## Development notes

```bash
npm run typecheck
npm run build
```

The old scraping services under `services/` are leftover from the previous architecture and are not used by the new backend.
