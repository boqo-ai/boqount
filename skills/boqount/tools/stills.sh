#!/usr/bin/env bash
# Look at a rendered film without playing it: a technical probe, contact sheets of stills, and one still per cue.
#
#   <skill>/tools/stills.sh <film.mp4> <out-dir> [cues.json] [--offset 0.25] [--every 0.5]
#
# Writes <out-dir>/probe.txt (codec, profile, size, frame rate, pixel format, colour tags, frame count, duration, bit
# rate), sheet-NN.png (one frame every --every seconds, default 0.5; 8x3 per sheet) and, given a cue sheet,
# cue-<line>-<word#>.png taken <offset> s after each word starts (the moment its beat should be visible).
# Stills are scaled to be readable: 432 px wide in a sheet, 1280 px for a cue still: enough to read type, small
# enough to look at many. Every variable is quoted and no input reaches eval or a shell command string. Needs ffmpeg and ffprobe, and node for the cue stills.
set -euo pipefail

usage() {
  echo "usage: stills.sh <film.mp4> <out-dir> [cues.json] [--offset 0.25] [--every 0.5]" >&2
  exit 2
}

offset=0.25
every=0.5
pos=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --offset) [[ $# -ge 2 ]] || usage; offset=$2; shift 2 ;;
    --every) [[ $# -ge 2 ]] || usage; every=$2; shift 2 ;;
    --*) usage ;;
    *) pos+=("$1"); shift ;;
  esac
done
[[ ${#pos[@]} -ge 2 && ${#pos[@]} -le 3 ]] || usage
# Numbers go into filter text and into -ss: only plain decimals pass.
num='^[0-9]+([.][0-9]+)?$'
[[ $offset =~ $num && $every =~ $num ]] || { echo "stills.sh: --offset and --every want plain numbers such as 0.25" >&2; exit 2; }
[[ "$every" != 0 && "$every" != 0.0 ]] || { echo "stills.sh: --every must be above 0" >&2; exit 2; }
in=${pos[0]}; out=${pos[1]}; cues=${pos[2]:-}
# A path that starts with "-" must not be read as an option by ffmpeg, ffprobe or mkdir.
[[ $in == -* ]] && in=./$in
[[ $out == -* ]] && out=./$out
[[ $cues == -* ]] && cues=./$cues
[[ -f "$in" ]] || { echo "stills.sh: no such file: $in" >&2; exit 1; }
[[ -z "$cues" || -f "$cues" ]] || { echo "stills.sh: no such cue sheet: $cues" >&2; exit 1; }
mkdir -p -- "$out"

ffprobe -v error -select_streams v:0 -show_entries \
  stream=codec_name,profile,width,height,r_frame_rate,avg_frame_rate,pix_fmt,color_space,color_primaries,color_transfer,nb_frames:format=duration,bit_rate \
  -of default=nw=1 "$in" | tee "$out/probe.txt"
ffmpeg -nostdin -v error -y -i "$in" -vf "fps=1/${every},scale=432:-1,tile=8x3" "$out/sheet-%02d.png"

if [[ -n "$cues" ]]; then
  node -e '
    const { lines } = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    const offset = Number(process.argv[2]);
    // A line id becomes part of a file name: anything but letters, digits, _ and - is replaced.
    for (const l of lines) l.words.forEach((w, i) => console.log((w.start + offset).toFixed(3), `cue-${String(l.id).replace(/[^A-Za-z0-9_-]/g, "_")}-${String(i).padStart(2, "0")}`));
  ' "$cues" "$offset" | while read -r t name; do
    ffmpeg -nostdin -v error -y -ss "$t" -i "$in" -frames:v 1 -vf scale=1280:-1 "$out/$name.png"
  done
fi
count=$(find "$out" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')
echo "files in $out: $count"
