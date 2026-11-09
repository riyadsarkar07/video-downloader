# Deployment Guide

This project has two independently deployed pieces:

| Piece | Where | What runs there |
| --- | --- | --- |
| Frontend | Vercel (or any Node host) | Next.js UI and thin `/api/*` proxy routes |
| Backend | Ubuntu VPS with Docker | Express API, `yt-dlp`, `ffmpeg`, job queue |

The backend must **not** run on Vercel. Serverless functions have short timeouts and no
persistent disk, and `yt-dlp`/`ffmpeg` are long-running native processes.

```
Browser ──HTTPS──▶ Vercel (Next.js) ──HTTPS──▶ Caddy ──▶ Express API ──▶ yt-dlp/ffmpeg
                    /api/* proxy routes           (VPS)     (private network)
```

---

## 1. VPS requirements

Minimum for light use (one or two concurrent downloads):

- Ubuntu 22.04 or 24.04 LTS, 2 vCPU, 2 GB RAM, 20 GB SSD
- A public IPv4 address and a domain you control (for TLS)
- Ports 80 and 443 open; do **not** expose 3001 to the internet

Heavier use (1080p merges, several concurrent jobs) needs more CPU and disk. `ffmpeg`
merging is CPU-bound, and temporary files can reach hundreds of MB per active job.

---

## 2. Install Docker on the VPS

```bash
# Update package lists
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker "$USER"
```

Log out and back in (or run `newgrp docker`) so the group change applies.

---

## 3. Get the code onto the VPS

```bash
# Clone the repository
git clone https://github.com/riyadsarkar07/video-downloader.git

# Enter the project
cd video-downloader
```

---

## 4. Backend environment variables

Create a production `.env` next to `docker-compose.yml`. This file is read by both the
`api` and `caddy` containers. It is git-ignored; never commit it.

```bash
# Copy the placeholder template
cp .env.example .env

# Then edit .env and fill in real values
```

Full backend reference:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Bind address inside the container |
| `PORT` | `3001` | API port inside the container |
| `DOWNLOAD_TMP_DIR` | `/tmp/unidown` | Temp storage for jobs (compose mounts a volume here) |
| `TRUST_PROXY` | `1` | Proxy hops trusted for `X-Forwarded-For` (Caddy is one hop) |
| `CORS_ORIGINS` | empty | Comma-separated browser origins if the browser calls the API directly. Leave empty when the frontend proxies `/api` |
| `YTDLP_BIN` | `yt-dlp` | yt-dlp binary path |
| `FFMPEG_BIN` | `/usr/bin/ffmpeg` | ffmpeg binary path |
| `YTDLP_COOKIES` | empty | Optional operator-owned Netscape cookies file (mount it read-only) |
| `EXTRACT_TIMEOUT_MS` | `45000` | Metadata extraction timeout |
| `DOWNLOAD_TIMEOUT_MS` | `300000` | Per-job download timeout |
| `JOB_TTL_MS` | `900000` | How long finished files are kept |
| `MAX_CONCURRENT_JOBS` | `2` | Parallel downloads |
| `MAX_QUEUED_JOBS` | `40` | Queue cap before `429 QUEUE_FULL` |
| `MAX_FILESIZE` | `500M` | yt-dlp `--max-filesize` |
| `MAX_DURATION_SEC` | `10800` | Reject media longer than 3 hours |
| `EXTRACT_RATE_LIMIT` | `20` | Extract requests per minute per IP |
| `DOWNLOAD_RATE_LIMIT` | `8` | Job creations per minute per IP |
| `FILE_RATE_LIMIT` | `60` | File downloads per minute per IP |
| `API_DOMAIN` | — | Public hostname Caddy serves and gets a certificate for |
| `ACME_EMAIL` | — | Contact email for Let's Encrypt |

---

## 5. Build and start the backend

```bash
# Build images and start the stack in the background
docker compose up -d --build

# Check that both containers are healthy
docker compose ps

# Tail API logs
docker compose logs -f api
```

Set `API_DOMAIN` and `ACME_EMAIL` in `.env` before starting, or Caddy will not be able to
obtain a certificate. Only Caddy publishes ports (80/443); the API stays on the private
compose network and is never reachable from the host directly.

### Verify health

```bash
# From the VPS, through Caddy over HTTPS
curl -fsS https://YOUR_API_DOMAIN/api/health
```

Expected shape:

```json
{"success":true,"status":"ok","engine":"yt-dlp","versions":{"ytDlp":"...","ffmpeg":"..."},"cookiesConfigured":false,"time":"..."}
```

If `versions.ytDlp` is `null`, the image was built without yt-dlp and the status is
`degraded`.

---

## 6. HTTPS reverse proxy (Caddy)

`deploy/Caddyfile` is already wired into compose. It:

- obtains and renews Let's Encrypt certificates automatically
- disables proxy buffering (`flush_interval -1`) so large files stream immediately
- sets `read_timeout`/`write_timeout` to `0` so long downloads are not cut off
- forwards the real client IP so per-IP rate limits work

Replace `{$API_DOMAIN}` and `{$ACME_EMAIL}` via `.env`; do not hardcode secrets.

If you already run Nginx, an equivalent server block is:

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 1m;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With Nginx, the API must be reachable at `127.0.0.1:3001`, so publish it bound to
loopback only: `ports: ["127.0.0.1:3001:3001"]`.

---

## 7. Firewall

```bash
# Allow SSH (adjust if you use a custom port)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS for Caddy / Let's Encrypt
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable the firewall
sudo ufw enable

# Confirm rules
sudo ufw status verbose
```

Never open 3001 publicly. Docker publishes ports by bypassing UFW, which is why compose
publishes only 80/443 and keeps the API on an internal network.

---

## 8. Vercel frontend deployment

1. Import the repository in Vercel.
2. Framework preset: **Next.js**. Build command `npm run build`, output is handled by Vercel.
3. Add an environment variable (Production and Preview):
   - **Key:** `BACKEND_URL`
   - **Value:** `https://YOUR_API_DOMAIN`
4. Deploy.

`BACKEND_URL` is read by the server-side proxy routes only; it is never inlined into the
browser bundle because it has no `NEXT_PUBLIC_` prefix.

### How the proxy works

- `app/api/*/route.ts` handlers run on the Node.js runtime and forward to
  `${BACKEND_URL}/api/*` using `lib/api.ts`.
- They return `502 BACKEND_UNREACHABLE` when the backend is offline, so the UI shows a
  clear error instead of hanging.
- `GET /api/jobs/:id/file` streams the upstream body through to the browser.

### Vercel limitations you must account for

- **Execution time limits.** Proxy routes declare `maxDuration` (60s for extract/download,
  300s for file streaming). On plans where the maximum is lower, a long download can be
  cut off.
- **Response streaming.** Vercel supports streaming responses, but long-lived large
  transfers count against function duration and bandwidth.
- **No persistent disk.** Never run yt-dlp or FFmpeg on Vercel.
- **Body size.** Request bodies are tiny JSON; config JSON is capped at 16 KB on the API.

For very large files, point the browser at the backend origin directly
(`https://api.example.com/api/jobs/:id/file`) or serve downloads through the VPS domain.
If you do that, set `CORS_ORIGINS` on the backend to your Vercel origin.

---

## 9. Secure update and restart

```bash
# Pull the latest code
git pull --ff-only

# Rebuild and recreate containers with zero-downtime rolling replace
docker compose up -d --build

# Confirm health after deploy
curl -fsS https://YOUR_API_DOMAIN/api/health

# Remove old dangling images
docker image prune -f
```

`docker compose up -d --build` recreates only changed services. The API has a 30-second
stop grace period; in-flight jobs are killed and marked failed, and temp files are cleaned
by the sweep on next start.

### Logs

```bash
# Follow API logs
docker compose logs -f api

# Follow proxy logs
docker compose logs -f caddy

# Show last 200 lines and exit
docker compose logs --tail=200 api
```

Log rotation is configured in `docker-compose.yml` (`max-size: 10m`, `max-file: 5` for the
API; `10m`/`3` for Caddy).

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `502 BACKEND_UNREACHABLE` in the UI | `BACKEND_URL` wrong, or backend down | Check `docker compose ps`, then `curl` the backend health URL |
| `/api/health` shows `degraded` | yt-dlp missing in the image | Rebuild the image; check `docker compose logs api` |
| Caddy has no certificate | DNS not pointing at the VPS, or ports 80/443 blocked | Verify an `A` record, reopen ports, `docker compose restart caddy` |
| Downloads fail with `BOT_CHECK` | Source blocks the server IP (e.g. YouTube datacenter IPs) | Not a code bug; do not bypass. An operator may mount their own cookies file |
| Jobs stuck in `processing` | Long media or slow source | Check `DOWNLOAD_TIMEOUT_MS`; watch `docker compose logs -f api` |
| `429 QUEUE_FULL` | Queue cap reached | Raise `MAX_QUEUED_JOBS` or `MAX_CONCURRENT_JOBS` on a bigger VPS |
| Disk filling up | Temp files retained | Lower `JOB_TTL_MS`; confirm the `unidown-tmp` volume is mounted |
| Rate limits trip too early | Proxy not forwarding real IP | Ensure Caddy/Nginx sets `X-Forwarded-For` and `TRUST_PROXY` matches hop count |

---

## 11. Security notes

- Containers run as the non-root `node` user with `no-new-privileges` and all capabilities
  dropped; the API root filesystem is read-only with a writable `/tmp` tmpfs and volume.
- Secrets live only in `.env` on the server, never in git.
- The API validates URLs, resolves DNS, and blocks private/loopback/metadata addresses,
  including IPv4-mapped, NAT64, and 6to4 IPv6 forms.
- Rate limits are per client IP; correct `TRUST_PROXY` is required behind a proxy.
- Never commit cookies. If you use `YTDLP_COOKIES`, mount it read-only and keep it outside
  the repo.
