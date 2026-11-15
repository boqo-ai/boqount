#!/usr/bin/env bash
# Shared keys for a team that runs one account from several machines: the keys are kept encrypted in the account's
# repository (secrets/keys.age) for each admin listed in secrets/people.txt, and each admin decrypts them with the
# SSH key they already push with. One person on one machine does not need this: keep the keys in ~/.config/boqount/.
#
#   bash <skill>/tools/keys.sh unlock [--dir <repo>]          decrypt secrets/keys.age into ~/.config/boqount/ (mode 600)
#   bash <skill>/tools/keys.sh lock [--dir <repo>]            re-encrypt the key files for every admin in secrets/people.txt
#   bash <skill>/tools/keys.sh add <login> [--dir <repo>]     add a GitHub login to secrets/people.txt, then lock
#   bash <skill>/tools/keys.sh remove <login> [--dir <repo>]  drop a login, then lock (and ROTATE the keys: they could read them)
#   bash <skill>/tools/keys.sh check [--dir <repo>]           which keys are in place on this machine (never prints a key)
#
# Recipients are each admin's SSH public keys as GitHub publishes them (https://github.com/<login>.keys), so an admin
# needs nothing new: the private key they already push with (~/.ssh/id_ed25519 or id_rsa) decrypts. age reads only
# ssh-ed25519 and ssh-rsa keys; other key types on an account are skipped. `lock` and `add` need an admin who already
# holds the keys in ~/.config/boqount/ (run `unlock` first). Commit secrets/ afterwards; the key files never are.
# The key files are the names in secrets/keys.txt (one per line), default: eleven.key fal.key.
# Needs `age` (https://age-encryption.org; `brew install age`). Bash 3.2-safe.
# Environment: BOQOUNT_KEYS_DEST overrides ~/.config/boqount; BOQOUNT_KEYS_URL overrides https://github.com (tests).
set -euo pipefail

ROOT="$PWD"
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) ROOT="${2:?--dir needs a folder}"; shift 2 ;;
    --dir=*) ROOT="${1#--dir=}"; shift ;;
    *) args+=("$1"); shift ;;
  esac
done
set -- ${args[@]+"${args[@]}"}
ROOT="$(cd "$ROOT" && pwd)"
DIR="$ROOT/secrets"
BLOB="$DIR/keys.age"
ADMINS="$DIR/people.txt"
RECIPIENTS="$DIR/recipients.txt"
DEST="${BOQOUNT_KEYS_DEST:-$HOME/.config/boqount}"
KEYS_URL="${BOQOUNT_KEYS_URL:-https://github.com}"

keys() {
  if [ -s "$DIR/keys.txt" ]; then grep -v '^[[:space:]]*#' "$DIR/keys.txt" | awk 'NF{print $1}'; else printf '%s\n' eleven.key fal.key; fi
}

need_age() {
  command -v age >/dev/null || { echo "keys: age is not installed (https://age-encryption.org; brew install age). Nothing changed." >&2; exit 2; }
}

need_admins() {
  test -s "$ADMINS" || { echo "keys: $ADMINS is missing: one GitHub login per line, then lock" >&2; exit 2; }
}

logins() { grep -v '^[[:space:]]*#' "$ADMINS" | awk 'NF{print $1}'; }

lock() {
  need_age; need_admins
  local present=""
  for k in $(keys); do
    if test -s "$DEST/$k"; then present="$present $k"; else echo "keys: $DEST/$k is missing; run unlock first, or remove it from secrets/keys.txt" >&2; exit 2; fi
  done
  local tmp login; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' RETURN
  : > "$tmp/recipients"
  for login in $(logins); do
    curl -fsS "$KEYS_URL/$login.keys" | grep -E '^(ssh-ed25519|ssh-rsa) ' | sed "s|\$| $login|" > "$tmp/$login" || true
    if [ ! -s "$tmp/$login" ]; then echo "keys: $login has no ssh-ed25519 or ssh-rsa key on GitHub; add one, then lock again" >&2; exit 2; fi
    cat "$tmp/$login" >> "$tmp/recipients"
  done
  mkdir -p "$DIR"
  # shellcheck disable=SC2086
  ( cd "$DEST" && COPYFILE_DISABLE=1 tar -cf - $present ) | age -R "$tmp/recipients" -o "$BLOB.new"
  mv "$BLOB.new" "$BLOB"
  { echo "# Written by keys.sh lock: the SSH keys secrets/keys.age is encrypted to. Do not edit."; cat "$tmp/recipients"; } > "$RECIPIENTS"
  echo "locked$present for: $(logins | tr '\n' ' ')"
  echo "now: git add secrets/ && git commit -m 'secrets: re-encrypt for <who>' -- secrets/"
}

unlock() {
  need_age
  test -s "$BLOB" || { echo "keys: $BLOB is missing (an admin who holds the keys runs lock first)" >&2; exit 2; }
  local ids=()
  for f in "$HOME/.ssh/id_ed25519" "$HOME/.ssh/id_rsa"; do [ -f "$f" ] && ids+=(-i "$f"); done
  [ ${#ids[@]} -gt 0 ] || { echo "keys: no ~/.ssh/id_ed25519 or ~/.ssh/id_rsa here" >&2; exit 2; }
  ( umask 077; mkdir -p "$DEST" )
  local tmp; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' RETURN
  if ! age -d "${ids[@]}" -o "$tmp/keys.tar" "$BLOB"; then
    echo "keys: cannot decrypt. Your GitHub login must be in secrets/people.txt and an admin must run lock after adding it." >&2
    exit 3
  fi
  for k in $(tar -tf "$tmp/keys.tar"); do
    if [ -e "$DEST/$k" ] && ! tar -xOf "$tmp/keys.tar" "$k" | cmp -s - "$DEST/$k"; then
      echo "keys: $DEST/$k exists and differs; kept as $DEST/$k.bak"; cp -p "$DEST/$k" "$DEST/$k.bak"
    fi
  done
  ( umask 077; tar -xf "$tmp/keys.tar" -C "$DEST" )
  for k in $(tar -tf "$tmp/keys.tar"); do chmod 600 "$DEST/$k"; done
  check
}

check() {
  for k in $(keys); do
    if test -s "$DEST/$k"; then echo "ok       $DEST/$k ($(stat -f %Lp "$DEST/$k" 2>/dev/null || stat -c %a "$DEST/$k"))"; else echo "MISSING  $DEST/$k"; fi
  done
}

case "${1:-}" in
  lock) lock ;;
  unlock) unlock ;;
  check) check ;;
  add)
    login="${2:?usage: keys.sh add <github-login>}"
    mkdir -p "$DIR"; touch "$ADMINS"
    logins | grep -qx "$login" || echo "$login" >> "$ADMINS"
    lock ;;
  remove)
    login="${2:?usage: keys.sh remove <github-login>}"
    need_admins
    grep -vx "$login" "$ADMINS" > "$ADMINS.new" || true; mv "$ADMINS.new" "$ADMINS"
    lock
    echo "ROTATE: $login could read the old keys. Make new keys at each service, put them in $DEST, then lock again." ;;
  *) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
