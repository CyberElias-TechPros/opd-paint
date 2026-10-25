#!/usr/bin/env bash
#
# Back up the enquiry log.
#
#   ./tools/backup.sh /var/backups/opudas
#
# Keeps 30 days. Enquiries are personal data, so the archive is created with
# restrictive permissions and should be stored encrypted off the host — this
# script deliberately does not pretend to solve that.

set -euo pipefail

DATA_DIR="${OPD_DATA_DIR:-$(dirname "$0")/../server/data}"
DEST="${1:-./backups}"
KEEP_DAYS="${OPD_BACKUP_DAYS:-30}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "No data directory at $DATA_DIR — nothing to back up." >&2
  exit 0
fi

mkdir -p "$DEST"
chmod 700 "$DEST"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$DEST/opudas-enquiries-$STAMP.tar.gz"

tar -czf "$ARCHIVE" -C "$DATA_DIR" .
chmod 600 "$ARCHIVE"

COUNT=$(grep -c . "$DATA_DIR/quotes.jsonl" 2>/dev/null || echo 0)
echo "Backed up $COUNT enquiry record(s) to $ARCHIVE"

# Rotation: delete archives older than the retention window.
find "$DEST" -name 'opudas-enquiries-*.tar.gz' -type f -mtime "+$KEEP_DAYS" -print -delete

echo "Retained archives:"
ls -1t "$DEST"/opudas-enquiries-*.tar.gz 2>/dev/null | head -5
