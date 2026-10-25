# OPUDA'S PAINT — one image, one process.
#
# Build the site with Node, then run the enquiry service which also serves the
# built files. No nginx, no supervisord, no database. A reverse proxy in front is
# still worthwhile for TLS and compression, but it is not required.

# ---------------------------------------------------------------- build stage
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so a source change does not invalidate the install layer.
COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app/ ./
COPY tools/ ../tools/
COPY server/ ../server/
RUN node ../tools/build-sitemap.mjs && npm run build

# -------------------------------------------------------------- runtime stage
FROM node:22-alpine AS runtime
WORKDIR /srv/opudas

ENV NODE_ENV=production \
    PORT=8787 \
    OPD_STATIC_DIR=/srv/opudas/app/dist \
    OPD_DATA_DIR=/srv/opudas/data

# The service uses only Node's standard library, so there is nothing to install.
COPY --from=build /app/dist ./app/dist
COPY server/ ./server/

RUN mkdir -p /srv/opudas/data && chown -R node:node /srv/opudas
USER node

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

# Enquiries are personal data: the volume is the only thing that must survive a
# container being replaced. See tools/backup.sh.
VOLUME ["/srv/opudas/data"]

CMD ["node", "server/index.mjs"]
