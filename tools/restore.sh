#!/usr/bin/env bash
#
# Restore the enquiry log from a backup archive.
#
#   ./tools/restore.sh /var/backups/opudas/opudas-enquiries-20261026T020000Z.tar.gz /srv/opudas/data
#
# An untested backup is not a backup, so this script is paired with
# `tools/verify-restore.sh`, which performs the whole round trip against
# throwaway data on every CI run. What follows are the checks that a real
# incident needs and that a happy-path script forgets:
#
#   * the archive is readable and every member is a plain file — a tar can carry
#     `../` paths and absolute symlinks, and extracting one blindly can write
#     outside the target;
#   * the JSONL is valid, line by line. A truncated final line is the expected
#     damage from a disk-full incident, and `jq`-less operators should still be
#     told which line is broken;
#   * an existing data directory is never overwritten silently. Restores happen
#     at 2 a.m. with shaking hands; the script asks, or requires --force;
#   * the result is reported in the terms that matter: how many enquiries, from
#     when to when.
#
# Usage:
#   ./tools/restore.sh ARCHIVE TARGET_DIR [--force]
#
set -euo pipefail

ARCHIVE="${1:-}"
TARGET="${2:-}"
FORCE="${3:-}"

if [[ -z "$ARCHIVE" || -z "$TARGET" ]]; then
  sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "error: no archive at $ARCHIVE" >&2
  exit 1
fi

# --- integrity before anything is written ------------------------------------
if ! tar -tzf "$ARCHIVE" >/dev/null 2>&1; then
  echo "error: $ARCHIVE is not a readable gzip tar — refusing to restore from it" >&2
  exit 1
fi

UNSAFE=0
while IFS= read -r member; do
  case "$member" in
    /*|*..*)
      echo "error: archive contains an unsafe path: $member" >&2
      UNSAFE=1
      ;;
  esac
done < <(tar -tzf "$ARCHIVE")
if [[ "$UNSAFE" -ne 0 ]]; then
  echo "error: refusing to extract $ARCHIVE" >&2
  exit 1
fi

if [[ -d "$TARGET" ]] && [[ -n "$(ls -A "$TARGET" 2>/dev/null || true)" && "$FORCE" != "--force" ]]; then
  echo "error: $TARGET already contains data." >&2
  echo "       Move it aside first, or pass --force to merge into it." >&2
  echo "       (Anything in the archive replaces the file of the same name.)" >&2
  exit 1
fi

# --- extract into a staging directory, then swap in ---------------------------
STAGING="$(mktemp -d "${TMPDIR:-/tmp}/opd-restore-XXXXXX")"
cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

tar -xzf "$ARCHIVE" -C "$STAGING" --no-same-owner

# --- split valid records from damaged ones -----------------------------------
#
# The realistic damaged archive is not a corrupt tarball: it is a good tarball
# of a data directory whose last append was cut short by a full disk or a
# `kill -9`. Refusing that archive leaves an operator with nothing at 2 a.m.,
# and dropping the bad line silently loses evidence. So: keep every good
# record, and move every damaged line verbatim into a sidecar file next to it.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if ! node - "$STAGING" "$STAMP" <<'NODE'
const { readdirSync, readFileSync, writeFileSync, statSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')

const [dir, stamp] = process.argv.slice(2)
let fatal = false
let quarantined = 0

for (const name of readdirSync(dir)) {
  if (!name.endsWith('.jsonl')) continue
  const path = join(dir, name)
  if (!statSync(path).isFile()) continue

  const lines = readFileSync(path, 'utf8').split('\n')
  const valid = []
  const damaged = []
  let index = 0
  for (const line of lines) {
    index += 1
    if (!line.trim()) continue
    try {
      const value = JSON.parse(line)
      if (value === null || typeof value !== 'object') throw new Error('not an object')
      if (value.truncated === true) throw new Error('marked truncated')
      valid.push(line)
    } catch {
      damaged.push(line)
    }
  }

  if (damaged.length) {
    const sidecar = `${path}.damaged-${stamp}`
    writeFileSync(sidecar, `${damaged.join('\n')}\n`, 'utf8')
    quarantined += damaged.length
    console.error(`  ${name}: ${damaged.length} damaged line(s) quarantined in ${sidecar.split('/').pop()}`)
  }

  if (!valid.length) {
    if (damaged.length) {
      console.error(`error: ${name} has no readable records — the wrong archive?`)
      fatal = true
    }
    continue
  }

  writeFileSync(path, `${valid.join('\n')}\n`, 'utf8')
  console.log(`  ${name}: ${valid.length} record(s) restored`)
}

if (quarantined) {
  console.error(`warning: ${quarantined} damaged line(s) were preserved but not restored.`)
  console.error('         Inspect the .damaged-* sidecar files before deleting them.')
}

process.exit(fatal ? 1 : 0)
NODE
then
  echo "error: nothing was restored; the staging directory is kept at $STAGING" >&2
  trap - EXIT
  exit 1
fi

# --- install ------------------------------------------------------------------
mkdir -p "$TARGET"
chmod 700 "$TARGET" 2>/dev/null || true
cp -a "$STAGING"/. "$TARGET"/

echo
echo "Restored into $TARGET"

QUOTES="$TARGET/quotes.jsonl"
if [[ -f "$QUOTES" ]]; then
  node - "$QUOTES" <<'NODE'
const { readFileSync } = require('node:fs')
const records = readFileSync(process.argv[2], 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((record) => record.receivedAt)
  .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))

if (!records.length) {
  console.log('  No enquiry records in this archive.')
  process.exit(0)
}
const first = records[0].receivedAt.slice(0, 10)
const last = records[records.length - 1].receivedAt.slice(0, 10)
console.log(`  ${records.length} enquiry record(s), ${first} → ${last}`)
console.log(`  Highest reference: ${records[records.length - 1].reference ?? 'unknown'}`)
NODE
fi

cat <<'EOF'

Next:
  1. Start the service against the restored data and check /api/health.
  2. Open /admin and confirm the enquiries are listed.
  3. Reconcile the record count against the archive's reported count — they
     must agree, or you have restored the wrong night's file.
EOF
