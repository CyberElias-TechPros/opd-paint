#!/usr/bin/env bash
#
# First-run bootstrap for an Oracle Cloud Always Free VM.
#
#   ssh ubuntu@<instance>
#   sudo bash deploy/bootstrap-oracle.sh
#
# Idempotent: every step checks whether it is already done, so re-running it
# after a partial failure is the intended recovery, not a risk. It installs
# nothing that is not needed to serve this site, and it never overwrites a
# configuration file that already exists.
#
# What it does, and why each step is here rather than in a document somebody
# has to remember to follow:
#
#   1. Node 22            the service is standard-library-only, but the *build*
#                         is not: vite, tsc and the prerender all run on Node.
#   2. swap               measured, not guessed — see the note in step 4.
#   3. opudas user        the service runs as a user that owns one directory.
#   4. /etc/opudas.env    with a *stable* OPD_SESSION_SECRET. Without it the
#                         service generates one per boot, and an Always Free
#                         instance is rebooted by Oracle for maintenance
#                         without asking, which signs the inbox out at a moment
#                         nobody chose.
#   5. host firewall      Oracle images ship rules that drop inbound traffic
#                         other than SSH. This is the step that makes a
#                         correctly-configured VCN still refuse connections.
#   6. nginx + certbot    TLS termination and renewal, which has to work
#                         unattended for years and is the part a stranger is
#                         most likely to have to debug.
#   7. systemd units      the service, and a timer for the nightly backup.
#
# It cannot do two things, and says so at the end rather than pretending: open
# the VCN security list (that lives in the Oracle console, above this VM), and
# obtain a TLS certificate (that needs DNS to resolve here first).

set -euo pipefail

DOMAIN="${OPD_DOMAIN:-opudapaint.com}"
APP_DIR="${OPD_APP_DIR:-/srv/opudas}"
DATA_DIR="$APP_DIR/data"
BACKUP_DIR="${OPD_BACKUP_DIR:-/var/backups/opudas}"
ENV_FILE=/etc/opudas.env
SERVICE_USER=opudas
NODE_MAJOR_REQUIRED=22

log()  { printf '\n\033[1m==>\033[0m %s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Run this as root: sudo bash deploy/bootstrap-oracle.sh"

# --------------------------------------------------------------- package manager
if command -v apt-get >/dev/null 2>&1; then
  PM=apt
elif command -v dnf >/dev/null 2>&1; then
  PM=dnf
else
  die "No apt-get or dnf. This script covers Ubuntu and Oracle Linux images;
    for anything else, follow docs/deploying.md Option D by hand."
fi
log "Package manager: $PM"

# A fresh image can ship with package lists old enough that an install fails on
# a package that certainly exists. Once, up front, rather than debugging a
# 404 halfway through a bootstrap.
if [ "$PM" = apt ]; then
  apt-get update -qq
fi

pkg_install() {
  if [ "$PM" = apt ]; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  else
    dnf install -y -q "$@"
  fi
}

# ------------------------------------------------------------------------- Node
log "Node.js"
have_node=0
if command -v node >/dev/null 2>&1; then
  have_node=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
fi
if [ "$have_node" -ge "$NODE_MAJOR_REQUIRED" ] 2>/dev/null; then
  note "already present: $(node -v)"
else
  note "installing Node 22 from NodeSource"
  if [ "$PM" = apt ]; then
    pkg_install ca-certificates curl gnupg
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    pkg_install nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    pkg_install nodejs
  fi
  note "installed: $(node -v)"
fi
command -v node >/dev/null 2>&1 || die "Node did not install."

# ------------------------------------------------------------------------- swap
# The production build was measured at roughly 530 MB of additional resident
# memory over 20 seconds on two cores (docs/adr/0005). The Always Free AMD
# shape has 1 GB and an eighth of an OCPU, so it can build — but only just, and
# slowly. Swap is insurance against the OOM killer deciding mid-prerender, and
# on a box that serves a small static site it will otherwise never be touched.
log "Swap"
if [ "$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)" -gt 0 ]; then
  note "already configured: $(swapon --show=SIZE --noheadings 2>/dev/null | tr -d ' ' || echo 'see /proc/meminfo')"
else
  MEM_MB=$(( $(awk '/^MemTotal:/{print $2}' /proc/meminfo) / 1024 ))
  note "MemTotal is ${MEM_MB} MB"
  if [ "$MEM_MB" -lt 1800 ]; then
    SWAP_GB=2
    note "creating a ${SWAP_GB} GB swapfile so the build cannot be OOM-killed"
    fallocate -l "${SWAP_GB}G" /swapfile 2>/dev/null \
      || dd if=/dev/zero of=/swapfile bs=1M count=$((SWAP_GB * 1024)) status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Swappiness 10: prefer RAM, use swap only under real pressure.
    sysctl -w vm.swappiness=10 >/dev/null
    grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  else
    note "enough memory; not creating swap"
  fi
fi

# --------------------------------------------------------------- user and paths
log "Service user and directories"
if id "$SERVICE_USER" >/dev/null 2>&1; then
  note "user $SERVICE_USER exists"
else
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER" 2>/dev/null \
    || useradd --system --home "$APP_DIR" --shell /sbin/nologin "$SERVICE_USER"
  note "created $SERVICE_USER"
fi
install -d -m 0755 -o "$SERVICE_USER" -g "$SERVICE_USER" "$APP_DIR"
install -d -m 0700 -o "$SERVICE_USER" -g "$SERVICE_USER" "$DATA_DIR"
install -d -m 0700 "$BACKUP_DIR"
note "$APP_DIR, $DATA_DIR (0700), $BACKUP_DIR (0700)"

# ----------------------------------------------------------------- environment
# This file is the difference between an inbox that survives a reboot and one
# that does not. It is created once and never rewritten: rotating a session
# secret signs every session out, which must be a decision, not a side effect
# of re-running a bootstrap script.
log "Configuration file: $ENV_FILE"
if [ -e "$ENV_FILE" ]; then
  note "exists; leaving it alone"
  grep -q '^OPD_SESSION_SECRET=..' "$ENV_FILE" \
    || note "WARNING: it does not set a non-empty OPD_SESSION_SECRET"
else
  SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
  install -m 600 /dev/null "$ENV_FILE"
  cat > "$ENV_FILE" <<ENVEOF
# OPUDA'S PAINT — production configuration.
#
# Root-owned, 0600, and read by the systemd unit at start. Every value in
# .env.example is documented there; only the ones that matter on this host are
# set here, and the rest keep their safe defaults.
#
# Changing OPD_SESSION_SECRET signs every inbox session out at once. That is
# the correct thing to do after a credential leak, and an accident at any other
# time — which is why this file is never rewritten by the bootstrap.
OPD_SESSION_SECRET=$SECRET

# nginx terminates TLS and forwards to 127.0.0.1:8787, so the service is one
# hop behind a trusted proxy. Without this, rate limits key on the proxy's
# address and twelve enquiries in ten minutes from one city locks out the city.
OPD_TRUST_PROXY=true

# Cookies are marked Secure even though the service itself sees plain HTTP,
# because the request the visitor made was HTTPS.
OPD_ADMIN_COOKIE_SECURE=true

# The inbox stays closed until these are set. With no account configured,
# /admin answers 404 rather than advertising that it exists.
OPD_ADMIN_USER=
OPD_ADMIN_PASSWORD=
# Second factor. Generate one with:  node server/auth.mjs --new-secret "<user>"
OPD_ADMIN_TOTP_SECRET=

# At least one channel, or a lead waits in the inbox for somebody to look.
OPD_NOTIFY_WEBHOOK=
OPD_RESEND_API_KEY=
OPD_NOTIFY_EMAIL=
OPD_NOTIFY_FROM=OPUDA'S PAINT <enquiries@$DOMAIN>

# Same origin: nginx serves the site and proxies /api, so no CORS rule and no
# OPD_ALLOWED_ORIGIN. Both stay empty on this host by design.
OPD_ALLOWED_ORIGIN=
OPD_API_ORIGIN=

OPD_ENV=production
OPD_LOG_LEVEL=info
OPD_RELEASE=
ENVEOF
  chmod 600 "$ENV_FILE"
  note "created with a generated OPD_SESSION_SECRET (0600, root)"
  note "the inbox and notification values are empty — see the summary at the end"
fi

# --------------------------------------------------------------- host firewall
# Oracle's Ubuntu and Oracle Linux images ship with host-level rules that drop
# inbound traffic except SSH. The VCN security list is a *second*, independent
# firewall above this VM, and both have to allow 80 and 443. Opening only the
# VCN produces the most confusing failure available here: nginx is listening,
# the certificate is valid, and nothing from the internet arrives.
log "Host firewall"
if command -v nft >/dev/null 2>&1 && nft list ruleset 2>/dev/null | grep -q .; then
  # Anchored on the character after the port, so 8080 does not read as 80.
  if nft list ruleset | grep -qE 'dport \{? ?(80|443)[ ,}]'; then
    note "nftables already allows 80/443"
  else
    nft insert rule inet filter input tcp dport '{ 80, 443 }' counter accept 2>/dev/null \
      && note "nftables: allowed 80/443" \
      || note "nftables: could not insert a rule — inspect 'nft list ruleset' by hand"
    command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save >/dev/null 2>&1 \
      && note "persisted" \
      || note "not persisted (no netfilter-persistent): rules will be lost on reboot"
  fi
elif command -v iptables >/dev/null 2>&1; then
  for port in 80 443; do
    if iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      note "iptables already allows $port"
    else
      # Insert after the SSH rule rather than appending: Oracle's default chain
      # ends in a REJECT, and an appended ACCEPT would never be reached.
      iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
      note "iptables: allowed $port"
    fi
  done
  if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save >/dev/null 2>&1 && note "persisted"
  else
    pkg_install iptables-persistent >/dev/null 2>&1 \
      && note "installed iptables-persistent and persisted" \
      || note "WARNING: rules are not persisted and will be lost on reboot"
  fi
else
  note "no nft or iptables found; assuming no host firewall"
fi

# ------------------------------------------------------------- nginx and TLS
# Installed here rather than left to the operator, because a fresh image does not
# have it, and because deploy/nginx.conf is written against this exact layout.
# Without nginx the failure looks like a service that is healthy on 127.0.0.1 and
# unreachable from everywhere else.
log "nginx and certbot"
if command -v nginx >/dev/null 2>&1; then
  note "nginx already installed"
else
  pkg_install nginx
  note "nginx installed"
fi
# certbot is not the only way to get a certificate, and on some images it is not
# packaged at all. That is a note rather than a failure: the site can serve over
# HTTP on this host while a certificate is arranged by other means.
if command -v certbot >/dev/null 2>&1; then
  note "certbot already installed"
elif pkg_install certbot python3-certbot-nginx >/dev/null 2>&1; then
  note "certbot installed"
else
  note "certbot could not be installed from the enabled repositories"
  note "on Oracle Linux it usually needs EPEL enabled first; obtain the"
  note "certificate by hand and point deploy/nginx.conf at it"
fi

# --------------------------------------------------------------- systemd units
log "systemd units"
REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
for unit in opudas.service opudas-backup.service opudas-backup.timer; do
  src="$REPO_DIR/deploy/$unit"
  [ -f "$src" ] || die "missing $src — run this script from a checkout of the repository"
  if [ -f "/etc/systemd/system/$unit" ] \
     && cmp -s "$src" "/etc/systemd/system/$unit"; then
    note "$unit unchanged"
  else
    install -m 644 "$src" "/etc/systemd/system/$unit"
    note "$unit installed"
  fi
done
systemctl daemon-reload
systemctl enable --quiet opudas.service opudas-backup.timer
systemctl start opudas-backup.timer
note "opudas enabled; backup timer started"
note "opudas.service is not started here: it needs the code in $APP_DIR first"

# --------------------------------------------------------------------- summary
cat <<SUMMARY

Bootstrap finished. What is left is work that cannot be done from inside
this VM, or that needs a decision from the business:

  1. VCN security list — allow ingress 80 and 443 in the Oracle console
     (Networking > Virtual Cloud Networks > your VCN > Security Lists).
     The host firewall above is a second, separate firewall. Both must allow
     it, and only one of them can be fixed from here.

  2. Code — get the repository into $APP_DIR and build it:

         sudo rsync -a --exclude node_modules --exclude .git ./ $APP_DIR/
         sudo chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
         cd $APP_DIR/app && npm ci && npm run build

     On the 1 GB AMD shape this build is slow and uses the swap created above.
     Building in CI and copying dist/ across is the faster alternative.

  3. TLS — point $DOMAIN at this instance's public IP, then:

         sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN

  4. Inbox credentials — edit $ENV_FILE and set OPD_ADMIN_USER,
     OPD_ADMIN_PASSWORD and OPD_ADMIN_TOTP_SECRET. Until then /admin answers
     404, which is the correct behaviour and not a bug to chase.

  5. Notifications — set OPD_NOTIFY_WEBHOOK, or the three Resend values.
     Without one of them an enquiry is stored and nobody is told.

  6. Start it:

         sudo systemctl start opudas
         curl -fsS http://127.0.0.1:8787/api/health

  7. Off-host backups — the timer writes to $BACKUP_DIR on this disk. A VM and
     its backups on the same block volume are one failure, not two. Copy the
     archives somewhere else; docs/deploying.md says what that means here.

  8. Prove the restore:  sudo bash $APP_DIR/tools/verify-restore.sh

SUMMARY
