#!/bin/sh
# Builds one scenario's world: tests/scenarios/runs/<ID>/work, a person's folder with the example account in it.
#
#   tests/scenarios/setup.sh <ID>
#
# The world is examples/quillfern (marketing/, brand/), the templates for any file the example leaves out, then the
# fixture's overlay/ on top (fixtures/<ID>/overlay), its sim/ in .sim/ (the simulated replies of outside calls, read by
# the dry-run preamble), and its films as plain colour clips made with ffmpeg (fixture.json → files). The skill under
# test is linked into work/agent-skills/: BOQOUNT_SRC names the tree (default: this repository).
# A fixture whose fixture.json says "product": true gets fixtures/<ID>/product instead (install and onboarding).
# NO_DM_ROWS=1 (or "no_dm_rows": true in fixture.json) empties brand/quillfern/accounts.md → DM automation. A world whose config says git_commit: on starts as a
# git repository with one commit, so a run's Save commits only what it wrote.
# Nothing here calls a model or a network: run.sh does the paid part.
set -e
here=$(cd "$(dirname "$0")" && pwd)
id=$1
[ -n "$id" ] || { echo "usage: setup.sh <ID>" >&2; exit 2; }
src=${BOQOUNT_SRC:-$(cd "$here/../.." && pwd)}
fx="$here/fixtures/$id"
run="$here/runs/$id"; w="$run/work"
rm -rf "$run"; mkdir -p "$w/agent-skills"
ln -s "$src/skills/boqount" "$w/agent-skills/boqount"
ln -s "$src/skills/boqount-research" "$w/agent-skills/boqount-research"

json() { [ -f "$fx/fixture.json" ] && node -e 'const f=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const v=f[process.argv[2]];if(v!==undefined)console.log(typeof v==="string"?v:JSON.stringify(v))' "$fx/fixture.json" "$1" || true; }

if [ "$(json product)" = true ]; then
  cp -R "$fx/product/." "$w/"
else
  cp -R "$src/examples/quillfern/marketing" "$src/examples/quillfern/brand" "$w/"
  T="$src/skills/boqount/templates"
  for f in ledger account budget; do [ -f "$w/marketing/$f.csv" ] || cp "$T/$f.csv" "$w/marketing/$f.csv"; done
  [ -f "$w/marketing/log.md" ] || printf '# Log\n' > "$w/marketing/log.md"
  [ -f "$w/marketing/state.md" ] || cp "$T/state.md" "$w/marketing/state.md"
  [ -f "$w/marketing/playbook.md" ] || cp "$T/playbook.md" "$w/marketing/playbook.md"
  [ -d "$fx/overlay" ] && cp -R "$fx/overlay/." "$w/"
  [ -d "$fx/sim" ] && { mkdir -p "$w/.sim"; cp -R "$fx/sim/." "$w/.sim/"; }
  mkdir -p "$w/incoming"
  files=$(json files)
  [ -n "$files" ] && [ "$files" != "[]" ] || files='[["incoming/watering-tip.mp4",6]]'
  printf '%s' "$files" | node -e 'for (const [p, s] of JSON.parse(require("fs").readFileSync(0, "utf8"))) console.log(p + "\t" + s)' |
  while IFS="$(printf '\t')" read -r path secs; do
    mkdir -p "$w/$(dirname "$path")"
    ffmpeg -nostdin -y -v error -f lavfi -i "color=c=0x1D2A22:s=1080x1920:r=60:d=$secs" -f lavfi -i "anullsrc=r=48000:cl=stereo" \
      -shortest -c:v libx264 -profile:v high -bf 0 -pix_fmt yuv420p -c:a aac "$w/$path"
  done
  if [ "${NO_DM_ROWS:-}" = 1 ] || [ "$(json no_dm_rows)" = true ]; then
    f="$w/brand/quillfern/accounts.md"
    awk '/^## DM automation/{print; print ""; print "None: the person runs no DM automation and has not said who answers a comment."; print ""; skip=1; next} /^## /{skip=0} !skip' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
  if grep -q '^git_commit: on' "$w/marketing/config.md"; then
    printf 'incoming/\n.sim/\n.boqo-upload/\nagent-skills/\n' > "$w/.gitignore"
    git -C "$w" init -q -b main
    git -C "$w" add -A
    git -C "$w" -c user.name=fixture -c user.email=fixture commit -qm "fixture $id"
  fi
fi
echo "$w"
