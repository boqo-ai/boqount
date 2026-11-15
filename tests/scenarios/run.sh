#!/bin/sh
# Runs one turn of a behaviour scenario as a headless Claude Code session in the world setup.sh built.
# EACH TURN IS A PAID SESSION on your Claude account: run it on purpose, never from `npm test` (which never runs it).
#
#   tests/scenarios/run.sh <ID> <turn> [first|next]      e.g. run.sh A1 1, then run.sh S7 2 next
#
# The prompt is prompts/<id>-t<turn>.txt; turn 1 of a fixture with a sim/ folder is prefixed with preamble.md (the
# dry-run rules, its {{NOW}} from fixture.json). {{SKILL_SRC}} in a prompt becomes the tree under test.
# The session: no MCP server, no skills or settings of this machine, no web tools, a fake HOME, the shims first on
# PATH (they record and refuse `gh`, `git push`, a network `git clone` and an `npm install` outside a film project).
# Isolation: Claude Code's sandbox is on (shell commands write only under work/ and home/, no network, no unsandboxed
# retry), file tools edit only there, and anything else that would ask for permission is denied (dontAsk).
# Output: runs/<ID>/turn-<time>.txt (the reply), runs/<ID>/shim.log (every refused call). Read them against the
# scenario's Pass and Fail lines in scenarios.md.
# Environment: MODEL (default sonnet); ALLOW_NET="a.example,b.example" opens those domains only (the real install
# line needs github.com and raw.githubusercontent.com); ALLOW_CLONE=1 lets one network clone through;
# BOQOUNT_NODE_MODULES: an installed films/project/node_modules the npm shim links instead of downloading.
set -e
here=$(cd "$(dirname "$0")" && pwd)
id=$1; turn=$2; mode=${3:-first}
[ -n "$id" ] && [ -n "$turn" ] || { echo "usage: run.sh <ID> <turn> [first|next]" >&2; exit 2; }
command -v claude >/dev/null || { echo "run.sh: the claude CLI is not on PATH" >&2; exit 2; }
src=${BOQOUNT_SRC:-$(cd "$here/../.." && pwd)}
lower=$(printf '%s' "$id" | tr 'A-Z' 'a-z')
promptfile="$here/prompts/$lower-t$turn.txt"
[ -f "$promptfile" ] || { echo "run.sh: no prompt $promptfile" >&2; exit 2; }
run="$here/runs/$id"
[ -d "$run/work" ] || { echo "run.sh: run setup.sh $id first" >&2; exit 2; }
mkdir -p "$run/home"
[ -f "$run/home/.gitconfig" ] || printf '[user]\n\tname = Test Person\n\temail = test\n[init]\n\tdefaultBranch = main\n' > "$run/home/.gitconfig"
[ -f "$run/session" ] || node -e 'console.log(require("crypto").randomUUID())' > "$run/session"
sid=$(cat "$run/session")
now=$(node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).now||"")}catch{console.log("")}' "$here/fixtures/$id/fixture.json")
prompt=$(sed "s#{{SKILL_SRC}}#$src#g" "$promptfile")
if [ "$turn" = 1 ] && [ -d "$here/fixtures/$id/sim" ]; then
  prompt="$(sed "s#{{NOW}}#$now#g" "$here/preamble.md")

$prompt"
fi
net=$(printf '%s' "${ALLOW_NET:-}" | awk -F, '{for(i=1;i<=NF;i++) printf "%s\"%s\"", (i>1?", ":""), $i}')
cat > "$run/settings.json" <<JSON
{
  "env": {"HOME": "$run/home", "PATH": "$here/shims:$PATH", "SHIM_LOG": "$run/shim.log", "REAL_NPM": "$(command -v npm)", "BOQOUNT_NODE_MODULES": "${BOQOUNT_NODE_MODULES:-}", "GIT_TERMINAL_PROMPT": "0", "ALLOW_CLONE": "${ALLOW_CLONE:-}"},
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "autoAllowBashIfSandboxed": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {"allowWrite": ["$run/home", "$run/shim.log"]},
    "network": {"allowedDomains": [$net], "strictAllowlist": true}
  },
  "permissions": {
    "allow": ["Read", "Glob", "Grep", "Bash", "Edit(./**)", "Edit(/$run/home/**)"],
    "deny": ["WebFetch", "WebSearch"]
  }
}
JSON
: >> "$run/shim.log"
cd "$run/work"
if [ "$mode" = first ]; then sess="--session-id $sid"; else sess="--resume $sid"; fi
# shellcheck disable=SC2086
claude -p "$prompt" $sess --model "${MODEL:-sonnet}" \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --setting-sources project --settings "$run/settings.json" \
  --disable-slash-commands --disallowedTools WebFetch WebSearch --permission-mode dontAsk \
  < /dev/null > "$run/turn-$(date +%H%M%S).txt" 2>&1 || echo "claude exited $?" >> "$run/turn-errors.txt"
ls -t "$run"/turn-*.txt | head -1
