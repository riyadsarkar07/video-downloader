#!/bin/bash
# Deterministic stand-in for yt-dlp used by the automated test suite.
# It never touches the network. Behaviour is chosen by a "mode=" marker in the URL:
#   mode=slow -> stay "downloading" until killed (used to test cancellation/queue limits)
#   mode=fail -> exit non-zero with an unsupported-URL error
#   otherwise -> emit progress and write a small fake MP4 into the output directory.
set -u

for arg in "$@"; do
  if [ "$arg" = "--version" ]; then
    echo "2026.10.26-fake"
    exit 0
  fi
done

for arg in "$@"; do
  if [ "$arg" = "-version" ]; then
    echo "ffmpeg version 9.9-fake Copyright (c) fake"
    exit 0
  fi
done

for arg in "$@"; do
  if [ "$arg" = "--dump-single-json" ]; then
    cat "$(dirname "$0")/metadata.json"
    exit 0
  fi
done

output=""
url=""
previous=""
for arg in "$@"; do
  if [ "$previous" = "-o" ]; then
    output="$arg"
  fi
  previous="$arg"
  url="$arg"
done

directory="$(dirname "$output")"
mode="normal"
case "$url" in
  *mode=slow*) mode="slow" ;;
  *mode=fail*) mode="fail" ;;
esac

echo "[download]   0.0% of 1.00MiB at 1.00MiB/s ETA 00:01" >&2
sleep 0.2
echo "[download]  25.0% of 1.00MiB at 1.00MiB/s ETA 00:00" >&2

if [ "$mode" = "fail" ]; then
  echo "ERROR: Unsupported URL: $url" >&2
  exit 1
fi

if [ "$mode" = "slow" ]; then
  echo "[download]  30.0% of 1.00MiB at 1.00MiB/s ETA 00:10" >&2
  for _ in $(seq 1 300); do
    sleep 0.1
  done
  exit 0
fi

sleep 0.4
echo "[download] 100% of 1.00MiB in 00:01" >&2
echo "[Merger] Merging formats into \"$directory/video.mp4\"" >&2

mkdir -p "$directory"
printf 'FAKE_MP4_PAYLOAD' > "$directory/video.mp4"
exit 0
