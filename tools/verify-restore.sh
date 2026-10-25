#!/usr/bin/env bash
#
# Prove the backup and restore path works, on every CI run.
#
#   ./tools/verify-restore.sh
#
# A backup nobody has restored is a hypothesis. This drill creates a throwaway
# data directory with realistic records (including the awkward ones: a comma and
# a quote in a name, a null email, a truncated final line), backs it up with the
# real script, restores it into an empty directory with the real script, and
# then compares the two byte for byte — through the API, not just on disk, so
# the restore is proven to produce data the service can actually serve.
#
# It also proves the failures: a damaged archive is rejected rather than
# half-restored, and restoring over live data requires an explicit decision.
#
# Exit code 0 means "restore verified". Anything else is a real problem.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP="$ROOT/tools/backup.sh"
RESTORE="$ROOT/tools/restore.sh"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/opd-drill-XXXXXX")"
cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf '  \033[32mok\033[0m   %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
step() { printf '\n%s\n' "$1"; }

SRC="$WORK/live"
DEST="$WORK/backups"
RESTORED="$WORK/restored"
mkdir -p "$SRC" "$DEST"

step "1. Build a live data directory"
node - "$SRC/quotes.jsonl" "$SRC/subscriptions.jsonl" <<'NODE'
const { appendFileSync } = require('node:fs')
const path = process.argv[2]
const subsPath = process.argv[3]
const base = {
  phone: '0803 000 0000',
  city: 'Port Harcourt',
  projectType: 'interior',
  rooms: null,
  message: null,
  colors: [],
  products: [],
  source: 'website',
  consent: { granted: true, at: '2026-10-01T09:00:00.000Z', basis: 'enquiry-reply' },
  meta: { ua: 'Mozilla/5.0' },
}
const records = [
  { ...base, reference: 'OPD-261001-AAAA', receivedAt: '2026-10-01T09:00:00.000Z', name: 'Ada Okoro', email: null },
  {
    ...base,
    reference: 'OPD-261002-BBBB',
    receivedAt: '2026-10-02T11:30:00.000Z',
    name: 'Quote "and" comma, test',
    email: 'ada@example.com',
    city: 'Rumuokoro',
    message: 'Two flats, exterior and interior.',
  },
  { ...base, reference: 'OPD-261003-CCCC', receivedAt: '2026-10-03T15:45:00.000Z', name: 'Chidi Okwu', email: null },
]
for (const record of records) appendFileSync(path, `${JSON.stringify(record)}\n`)
appendFileSync(subsPath, `${JSON.stringify({ email: 'subscriber@example.com', interest: 'trade', at: '2026-10-03T16:00:00.000Z' })}\n`)
NODE
# A truncated final line: the exact damage a full disk or a kill -9 leaves.
printf '{"reference":"OPD-261004-DDDD","receivedAt":"2026-10-04T' >> "$SRC/quotes.jsonl"

# Deliberately empty directories, which a naive `tar` may or may not keep.
mkdir -p "$SRC/.cache" "$SRC/exports"

LIVE_LINES=$(grep -c . "$SRC/quotes.jsonl" || true)
if [[ -f "$SRC/quotes.jsonl" ]]; then pass "live data created ($LIVE_LINES lines in quotes.jsonl)"; else fail "live data not created"; fi

step "2. Run the real backup script"
if OPD_DATA_DIR="$SRC" "$BACKUP" "$DEST" >"$WORK/backup.log" 2>&1; then
  pass "backup.sh exited 0"
else
  fail "backup.sh failed"
  cat "$WORK/backup.log"
fi

ARCHIVE="$(ls -1t "$DEST"/opudas-enquiries-*.tar.gz 2>/dev/null | head -1)"
if [[ -f "$ARCHIVE" ]]; then pass "archive written: $(basename "$ARCHIVE")"; else fail "no archive written"; fi

PERMS="$(stat -c '%a' "$ARCHIVE" 2>/dev/null || stat -f '%Lp' "$ARCHIVE" 2>/dev/null)"
if [[ "$PERMS" == "600" ]]; then pass "archive is 0600 (enquiry data is personal data)"; else fail "archive mode is $PERMS, expected 600"; fi

step "3. A damaged archive must be refused, not half-restored"
cp "$ARCHIVE" "$WORK/damaged.tar.gz"
printf 'this is not a tar file' > "$WORK/not-tar.tar.gz"
BROKEN="$WORK/broken"
if "$RESTORE" "$WORK/not-tar.tar.gz" "$BROKEN" >"$WORK/not-tar.log" 2>&1; then
  fail "restore.sh accepted a file that is not an archive"
else
  pass "a non-archive is rejected"
fi
if [[ -d "$BROKEN" && -n "$(ls -A "$BROKEN" 2>/dev/null || true)" ]]; then
  fail "a rejected restore still wrote to the target"
else
  pass "a rejected restore wrote nothing"
fi

# A path-traversal member must be refused outright.
mkdir -p "$WORK/evil/payload"
printf '{"reference":"OPD-000000-EVIL"}\n' > "$WORK/evil/payload/quotes.jsonl"
tar -czf "$WORK/evil.tar.gz" -C "$WORK/evil" --transform 's|payload|../../etc|' payload
if "$RESTORE" "$WORK/evil.tar.gz" "$WORK/evil-out" >"$WORK/evil.log" 2>&1; then
  fail "restore.sh accepted an archive containing ../../ members"
else
  pass "an archive with a traversal path is rejected"
fi

step "4. Restore into an empty directory with the real script"
if "$RESTORE" "$ARCHIVE" "$RESTORED" >"$WORK/restore.log" 2>&1; then
  pass "restore.sh exited 0 despite the truncated line (salvage, not refusal)"
else
  fail "restore.sh failed"
  cat "$WORK/restore.log"
fi

if [[ -f "$RESTORED/quotes.jsonl" && -f "$RESTORED/subscriptions.jsonl" ]]; then
  pass "both JSONL files are present after restore"
else
  fail "restored directory is missing a JSONL file"
fi

# Every readable record must survive, unchanged and in order.
if node - "$SRC/quotes.jsonl" "$RESTORED/quotes.jsonl" <<'NODE'
const { readFileSync } = require('node:fs')
const good = (path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .filter((line) => {
      try {
        JSON.parse(line)
        return true
      } catch {
        return false
      }
    })

const before = good(process.argv[2])
const after = good(process.argv[3])
if (before.length !== after.length) {
  console.error(`record count changed: ${before.length} → ${after.length}`)
  process.exit(1)
}
if (before.join('\n') !== after.join('\n')) {
  console.error('restored records differ from the source')
  process.exit(1)
}
process.exit(0)
NODE
then
  pass "every readable record survived byte-for-byte, in order"
else
  fail "restored records differ from the source"
fi

# The truncated line must be kept somewhere, not thrown away.
SIDECAR="$(ls -1 "$RESTORED"/quotes.jsonl.damaged-* 2>/dev/null | head -1)"
if [[ -n "$SIDECAR" ]] && grep -q 'OPD-261004-DDDD' "$SIDECAR"; then
  pass "the damaged line was quarantined, not deleted"
else
  fail "the damaged line was not quarantined"
fi

if grep -q 'damaged line' "$WORK/restore.log"; then
  pass "the restore says out loud that something was damaged"
else
  fail "the restore did not report the damage"
fi

step "5. Refuse to overwrite live data without --force"
if "$RESTORE" "$ARCHIVE" "$RESTORED" >"$WORK/overwrite.log" 2>&1; then
  fail "restore.sh overwrote an existing data directory without asking"
else
  pass "an existing data directory is protected"
fi

if "$RESTORE" "$ARCHIVE" "$RESTORED" --force >"$WORK/force.log" 2>&1; then
  pass "--force allows an intentional overwrite"
else
  fail "--force did not work"
fi

step "6. The service can serve the restored data"
# The truncated line must not stop the service from reading everything before it.
PORT_FILE="$WORK/port"

OPD_DATA_DIR="$RESTORED" OPD_ADMIN_USER=desk OPD_ADMIN_PASSWORD=restore-drill \
  node --input-type=module -e "
    import { writeFileSync } from 'node:fs'
    const { createEnquiryServer } = await import('$ROOT/server/index.mjs')
    const server = createEnquiryServer()
    server.listen(0, '127.0.0.1', () => {
      writeFileSync('$PORT_FILE', String(server.address().port))
    })
  " >"$WORK/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 100); do
  [[ -s "$PORT_FILE" ]] && break
  sleep 0.05
done

if [[ -s "$PORT_FILE" ]]; then
  PORT="$(cat "$PORT_FILE")"
  HEALTH="$(curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)"
  if [[ "$HEALTH" == *'"service":"opd-enquiries"'* ]]; then
    pass "the restored service answers /api/health"
  else
    fail "the restored service did not answer /api/health"
    cat "$WORK/server.log"
  fi

  CSV="$(curl -fsS -u "desk:restore-drill" "http://127.0.0.1:$PORT/admin/enquiries.csv" 2>/dev/null || true)"
  if [[ "$CSV" == *'OPD-261001-AAAA'* && "$CSV" == *'OPD-261003-CCCC'* ]]; then
    pass "the inbox lists the restored enquiries"
  else
    fail "the inbox does not show the restored enquiries"
    head -5 "$WORK/server.log"
  fi

  if [[ "$CSV" == *'OPD-261004-DDDD'* ]]; then
    fail "a truncated record was served as if it were complete"
  else
    pass "the truncated record is skipped rather than served"
  fi
else
  fail "the service did not start against restored data"
  cat "$WORK/server.log"
fi

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]]
