#!/usr/bin/env bash
#
# Roll back a deployment — roadmap 17.03.09.
#
#   ./tools/rollback.sh --check                 # what could be rolled back to? (changes nothing)
#   ./tools/rollback.sh --snapshot              # keep the running release, so it can be returned to
#   ./tools/rollback.sh                         # roll back, then prove the site came up
#   ./tools/rollback.sh --target 20261101T0930  # roll back to a specific snapshot
#   ./tools/rollback.sh --mode docker|systemd   # force a mode instead of detecting one
#
# The one idea in this script: **you cannot roll back to something you did not
# keep.** A deploy that overwrites `latest` — or overwrites /srv/opudas in place —
# leaves nothing to go back to, and the rollback plan becomes "rebuild from an
# older commit while the site is down". So `--snapshot` is part of deploying, not
# part of failing, and `--check` says out loud when there is nothing to go back
# to. Run `--check` monthly; that is the exercise, and it takes ten seconds.
#
# After a rollback the script waits for `/api/health` to answer with storage
# ready, because "the container started" is not "the site works".

set -euo pipefail

IMAGE="${OPD_ROLLBACK_IMAGE:-opudas-paint}"
RELEASES_DIR="${OPD_RELEASES_DIR:-/srv/opudas-releases}"
SERVE_DIR="${OPD_SERVE_DIR:-/srv/opudas}"
COMPOSE_FILE="${OPD_COMPOSE_FILE:-docker-compose.yml}"
UNIT="${OPD_SYSTEMD_UNIT:-opudas}"
PORT="${PORT:-8787}"
HEALTH_URL="${OPD_HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"
HEALTH_TRIES="${OPD_HEALTH_TRIES:-30}"
KEEP_SNAPSHOTS="${OPD_KEEP_SNAPSHOTS:-8}"

MODE=""
TARGET=""
ACTION="rollback"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) ACTION="check"; shift ;;
    --snapshot) ACTION="snapshot"; shift ;;
    --rollback) ACTION="rollback"; shift ;;
    --mode) MODE="${2:?--mode needs docker or systemd}"; shift 2 ;;
    --target) TARGET="${2:?--target needs a snapshot name}"; shift 2 ;;
    -h|--help) sed -n '3,26p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "rollback: unknown argument \"$1\" (try --help)" >&2; exit 2 ;;
  esac
done

stamp() { date -u +%Y%m%dT%H%M%SZ; }
say() { printf '%s %s\n' "$(stamp)" "$*"; }
die() { printf '%s %s\n' "$(stamp)" "$*" >&2; exit 1; }

# ------------------------------------------------------------------ detect

detect_mode() {
  if [[ -n "$MODE" ]]; then echo "$MODE"; return; fi
  if docker compose version >/dev/null 2>&1 && [[ -f "$COMPOSE_FILE" ]]; then echo "docker"; return; fi
  if systemctl list-unit-files 2>/dev/null | grep -q "^${UNIT}.service"; then echo "systemd"; return; fi
  echo "none"
}

MODE="$(detect_mode)"

# ---------------------------------------------------------------- health

wait_for_health() {
  local attempt=1
  while (( attempt <= HEALTH_TRIES )); do
    if body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)"; then
      storage="$(printf '%s' "$body" | grep -o '"storage":"[^"]*"' | cut -d'"' -f4 || true)"
      version="$(printf '%s' "$body" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || true)"
      if [[ "$storage" == "ready" ]]; then
        say "healthy: storage ready, release ${version:-unknown} (attempt ${attempt})"
        return 0
      fi
      say "answered but storage is \"${storage:-unknown}\" — the service is up with nowhere to write (attempt ${attempt})"
    else
      say "no answer from ${HEALTH_URL} (attempt ${attempt}/${HEALTH_TRIES})"
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  return 1
}

# ---------------------------------------------------------------- docker

docker_snapshots() {
  docker image ls --format '{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}' \
    | grep "^${IMAGE}:" | grep -v ":latest$" | sort -r || true
}

docker_snapshot() {
  local tag="${IMAGE}:$(stamp)"
  docker image inspect "${IMAGE}:latest" >/dev/null 2>&1 \
    || die "no ${IMAGE}:latest image to snapshot — build and deploy first"
  docker tag "${IMAGE}:latest" "$tag"
  say "kept the running release as ${tag}"
  # Keep the last few and no more: images are gigabytes, and a rollback target
  # nobody will ever choose is only a disk filling up.
  local stale
  stale="$(docker_snapshots | tail -n +$((KEEP_SNAPSHOTS + 1)) | cut -f1 || true)"
  if [[ -n "$stale" ]]; then
    while read -r image; do
      [[ -n "$image" ]] && docker rmi "$image" >/dev/null 2>&1 && say "removed old snapshot ${image}"
    done <<< "$stale"
  fi
}

docker_rollback() {
  local target="$1"
  [[ -n "$target" ]] || die "no snapshot to roll back to — run --snapshot before each deploy"
  docker image inspect "$target" >/dev/null 2>&1 || die "snapshot ${target} is not on this host"

  local previous="${IMAGE}:pre-rollback-$(stamp)"
  docker tag "${IMAGE}:latest" "$previous" 2>/dev/null || true
  say "the release being replaced is kept as ${previous}, in case this rollback is the mistake"

  docker tag "$target" "${IMAGE}:latest"
  say "pointed ${IMAGE}:latest at ${target}"
  docker compose -f "$COMPOSE_FILE" up -d
  say "restarted the service"
}

# --------------------------------------------------------------- systemd

systemd_snapshot() {
  [[ -d "$SERVE_DIR" ]] || die "no ${SERVE_DIR} to snapshot"
  mkdir -p "$RELEASES_DIR"
  local dest="${RELEASES_DIR}/$(stamp)"
  # Everything except the data directory: enquiries live on the volume/disk and a
  # rollback must never touch them.
  tar -czf "${dest}.tar.gz" -C "$SERVE_DIR" \
    --exclude=./data --exclude=./node_modules/.cache . 2>/dev/null \
    || die "could not snapshot ${SERVE_DIR}"
  chmod 600 "${dest}.tar.gz"
  say "kept the running release as ${dest}.tar.gz"
  local stale
  stale="$(ls -1t "${RELEASES_DIR}"/*.tar.gz 2>/dev/null | tail -n +$((KEEP_SNAPSHOTS + 1)) || true)"
  if [[ -n "$stale" ]]; then
    while read -r file; do [[ -n "$file" ]] && rm -f "$file" && say "removed old snapshot $(basename "$file")"; done <<< "$stale"
  fi
}

systemd_snapshots() {
  ls -1t "${RELEASES_DIR}"/*.tar.gz 2>/dev/null | while read -r file; do
    printf '%s\t%s\n' "$(basename "$file" .tar.gz)" "$(date -u -r "$file" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
  done
}

systemd_rollback() {
  local target="$1"
  [[ -n "$target" ]] || die "no snapshot in ${RELEASES_DIR} to roll back to — run --snapshot before each deploy"
  local archive
  if [[ -f "$target" ]]; then archive="$target"; else archive="${RELEASES_DIR}/${target}.tar.gz"; fi
  [[ -f "$archive" ]] || die "no archive at ${archive}"

  local undo="${RELEASES_DIR}/pre-rollback-$(stamp).tar.gz"
  tar -czf "$undo" -C "$SERVE_DIR" --exclude=./data --exclude=./node_modules/.cache . 2>/dev/null || true
  chmod 600 "$undo" 2>/dev/null || true
  say "the release being replaced is kept as $(basename "$undo")"

  # Extract over the top rather than swapping a symlink: the systemd unit points
  # at a real path, and a symlink swap would need the unit to change too.
  tar -xzf "$archive" -C "$SERVE_DIR" || die "could not restore ${archive} into ${SERVE_DIR}"
  say "restored $(basename "$archive") into ${SERVE_DIR}"
  systemctl restart "$UNIT"
  say "restarted ${UNIT}.service"
}

# ------------------------------------------------------------------ main

case "$MODE" in
  none)
    die "no deployment detected here (looked for docker compose with ${COMPOSE_FILE}, or a ${UNIT}.service unit).
       Pass --mode docker or --mode systemd, or run this on the host."
    ;;
esac

say "mode ${MODE} · health ${HEALTH_URL}"

case "$ACTION" in
  snapshot)
    if [[ "$MODE" == docker ]]; then docker_snapshot; else systemd_snapshot; fi
    ;;

  check)
    say "rollback exercise — nothing will be changed"
    if [[ "$MODE" == docker ]]; then
      running="$(docker image inspect --format '{{.Id}}' "${IMAGE}:latest" 2>/dev/null || echo none)"
      say "running image: ${IMAGE}:latest (${running:0:19})"
      mapfile -t snaps < <(docker_snapshots | cut -f1)
    else
      say "serving directory: ${SERVE_DIR}"
      systemctl is-active "${UNIT}.service" 2>/dev/null | sed 's/^/  unit status: /' || say "unit status: unknown"
      mapfile -t snaps < <(systemd_snapshots | cut -f1)
    fi

    if [[ ${#snaps[@]} -eq 0 ]]; then
      say "NOTHING TO ROLL BACK TO. Run './tools/rollback.sh --snapshot' before each deploy."
      exit 1
    fi
    say "${#snaps[@]} snapshot(s) available, newest first:"
    for snap in "${snaps[@]:0:5}"; do say "  ${snap}"; done

    if wait_for_health; then
      say "the current release is healthy, so a rollback now would be a choice and not a rescue"
    else
      say "the current release is NOT healthy — this is the moment a rollback is for"
      exit 1
    fi
    ;;

  rollback)
    if [[ -n "$TARGET" ]]; then
      chosen="$TARGET"
    elif [[ "$MODE" == docker ]]; then
      chosen="$(docker_snapshots | head -1 | cut -f1 || true)"
    else
      chosen="$(systemd_snapshots | head -1 | cut -f1 || true)"
    fi
    say "rolling back to ${chosen:-<nothing available>}"
    if [[ "$MODE" == docker ]]; then docker_rollback "$chosen"; else systemd_rollback "$chosen"; fi

    if wait_for_health; then
      say "rollback complete and verified"
      say "next: run the smoke test against the public origin —"
      say "      node tools/smoke-production.mjs --origin https://opudapaint.com"
    else
      say "ROLLBACK DID NOT PRODUCE A HEALTHY SERVICE."
      say "The release that was running before this rollback was kept; to put it back:"
      if [[ "$MODE" == docker ]]; then
        say "  docker tag <pre-rollback image> ${IMAGE}:latest && docker compose -f ${COMPOSE_FILE} up -d"
      else
        say "  sudo tar -xzf ${RELEASES_DIR}/pre-rollback-*.tar.gz -C ${SERVE_DIR} && sudo systemctl restart ${UNIT}"
      fi
      say "Then check the data directory and the logs — a service that will not come up after a"
      say "rollback is usually telling you something about its configuration, not its code."
      exit 1
    fi
    ;;
esac
