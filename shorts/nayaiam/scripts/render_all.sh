#!/usr/bin/env bash
# Resumable full render in 150-frame chunks (software GL is slow), then concat + mux with the mix.
# usage: POST='{"msaa":0,...}' SCALE=0.6667 scripts/render_all.sh
set -u
cd "$(dirname "$0")/.."
TOTAL=2010; STEP=150; SCALE=${SCALE:-0.6667}
mkdir -p out/chunks
for ((a=0; a<TOTAL; a+=STEP)); do
  b=$((a+STEP-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f=out/chunks/c_$(printf %04d $a).mp4
  [ -s "$f" ] && continue
  echo "chunk $a-$b start $(date +%T)"
  node scripts/render.mjs "$f.tmp.mp4" "$SCALE" "$a-$b" 1 2>&1 | grep -E "^done|rror|crash" || true
  if [ -s "$f.tmp.mp4" ]; then mv "$f.tmp.mp4" "$f"; echo "chunk $a-$b ok $(date +%T)"; else echo "chunk $a-$b FAILED"; exit 1; fi
done
ls out/chunks/c_*.mp4 | sed "s/^/file '/; s/$/'/; s#file 'out/chunks/#file '#" > out/chunks/list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i out/chunks/list.txt -c copy out/video_silent.mp4
ffmpeg -loglevel error -y -i out/video_silent.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest out/nayaiam_final.mp4
echo "ALL DONE $(date +%T)"
