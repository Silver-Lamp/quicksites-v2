#!/usr/bin/env bash
# .claude/skills/serp-screenshots/stitch.sh
#
# Stitch a scrolled sequence of macOS SERP screenshots into one continuous page.
#
# Two jobs, and both are about making the result READABLE rather than tidy:
#
# ⚠️ 1. CROP THE BROWSER CHROME. Every capture repeats the menu bar, tab strip, URL bar and
# bookmarks — about 225pt. Concatenated raw, six shots contain six copies of the Google search
# box, and "what is above the first organic result" becomes unanswerable because the page's own
# order is cut up by furniture. Kept on the FIRST shot only: that is where the query and the
# location chip live, and both are needed to know what was even measured.
#
# ⚠️ 2. REMOVE THE SCROLL OVERLAP, WHICH IS THE ONE THAT CAUSES WRONG ANSWERS. Nobody scrolls
# exactly one viewport, so consecutive shots share content. Appended naively, the first six-shot
# test run showed Yelp twice, Fitz Towing twice and a Reddit thread twice — and a duplicated first
# organic result is exactly the misreading this whole tool exists to avoid. So each shot is
# matched against the previous one's tail and the repeated band is cut.
#
# Usage:
#   stitch.sh OUT.png SHOT1.png SHOT2.png ...        # shots in SCROLL ORDER, top first
#   CHROME_PT=225 BOTTOM_PT=95 stitch.sh out.png ~/Desktop/Screenshot*.png
#
# Defaults suit a Retina macOS Chrome window (2x). Override via env for a different window, and
# LOOK at the output before trusting it — a bad crop is silent.

set -euo pipefail

OUT="${1:?usage: stitch.sh OUT.png SHOT...}"
shift
[ "$#" -ge 1 ] || { echo "no input screenshots given" >&2; exit 1; }

CHROME_PT="${CHROME_PT:-225}"      # menu bar + tabs + URL + bookmarks
BOTTOM_PT="${BOTTOM_PT:-95}"       # whatever sits under the browser window
SCALE="${SCALE:-2}"                # 2 for a Retina capture
STRIP="${STRIP:-200}"              # px of tail used as the overlap fingerprint
SEARCH_SCALE="${SEARCH_SCALE:-8}"  # downscale factor for the match (speed)
MAX_RMSE="${MAX_RMSE:-0.18}"       # above this the match is not believed

chrome=$(( CHROME_PT * SCALE ))
bottom=$(( BOTTOM_PT * SCALE ))

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Check the crop values against the real images BEFORE doing any work. Without this a bad
# CHROME_PT surfaces as ImageMagick's "no decode delegate" on an empty crop several steps later,
# which reads like a broken tool rather than a wrong setting.
for f in "$@"; do
  [ -f "$f" ] || { echo "not a file: $f" >&2; exit 1; }
  h=$(magick identify -format '%h' "$f" 2>/dev/null) || { echo "not an image: $f" >&2; exit 1; }
  if [ $(( chrome + bottom + STRIP )) -ge "$h" ]; then
    echo "CHROME_PT (${CHROME_PT}) + BOTTOM_PT (${BOTTOM_PT}) at ${SCALE}x leaves nothing of $(basename "$f") (${h}px tall)." >&2
    echo "Lower them, or set SCALE=1 if these are not Retina captures." >&2
    exit 1
  fi
done

i=0
prev=""
prev_keep_end=0
for f in "$@"; do
  h=$(magick identify -format '%h' "$f")
  keep_end=$(( h - bottom ))

  if [ "$i" -eq 0 ]; then
    magick "$f" -crop "x${keep_end}+0+0" +repage "$tmp/$(printf '%03d' $i).png"
    prev="$f"; prev_keep_end="$keep_end"; i=1
    continue
  fi

  # Fingerprint = the last STRIP px of what the previous shot actually showed.
  strip_start=$(( prev_keep_end - STRIP ))
  [ "$strip_start" -gt "$chrome" ] || strip_start=$chrome
  pct=$(awk -v s="$SEARCH_SCALE" 'BEGIN{printf "%.4f", 100/s}')
  magick "$prev" -crop "x${STRIP}+0+${strip_start}" +repage -resize "${pct}%" "$tmp/strip.png"
  magick "$f" -resize "${pct}%" "$tmp/hay.png"

  # `compare -subimage-search` prints "<rmse> (<norm>) @ x,y" to stderr.
  res=$(magick compare -metric RMSE -subimage-search "$tmp/hay.png" "$tmp/strip.png" "$tmp/_m.png" 2>&1 | tail -1 || true)
  norm=$(printf '%s' "$res" | sed -n 's/.*(\([0-9.]*\)).*/\1/p' | head -1)
  matchy=$(printf '%s' "$res" | sed -n 's/.*@ [0-9]*,\([0-9]*\).*/\1/p' | head -1)

  start=$chrome
  if [ -n "${norm:-}" ] && [ -n "${matchy:-}" ] && awk -v n="$norm" -v m="$MAX_RMSE" 'BEGIN{exit !(n<m)}'; then
    # The previous shot's tail reappears at `matchy`; everything up to the end of that repeated
    # band is a duplicate, so start just past it.
    cand=$(( matchy * SEARCH_SCALE + STRIP ))
    if [ "$cand" -gt "$chrome" ] && [ "$cand" -lt "$keep_end" ]; then
      start=$cand
      echo "  shot $((i+1)): overlap matched (rmse ${norm}) — trimming to +${start}px" >&2
    else
      echo "  shot $((i+1)): overlap offset ${cand}px out of range — chrome crop only" >&2
    fi
  else
    echo "  shot $((i+1)): no confident overlap match (rmse ${norm:-n/a}) — chrome crop only" >&2
  fi

  keep=$(( keep_end - start ))
  if [ "$keep" -le 0 ]; then
    echo "  shot $((i+1)): nothing new after trimming — skipped" >&2
  else
    magick "$f" -crop "x${keep}+0+${start}" +repage "$tmp/$(printf '%03d' $i).png"
  fi
  prev="$f"; prev_keep_end="$keep_end"; i=$(( i + 1 ))
done

magick "$tmp"/[0-9]*.png -append "$OUT"
magick identify -format 'stitched %f  %wx%h  from '"$#"' shots\n' "$OUT"
