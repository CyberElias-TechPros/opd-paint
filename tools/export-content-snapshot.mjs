#!/usr/bin/env node
/**
 * Export a plain-JSON snapshot of the typed content the admin layer edits.
 *
 * The admin server (`server/admin-content.mjs`) is a dependency-free Node
 * process with no TypeScript toolchain, so it cannot `import` the `.ts` data
 * modules directly. This script runs in the one place that already solves
 * that problem — the same Node ESM loader hooks the test suite uses — and
 * writes out exactly the fields the admin UI needs to list dealers, products,
 * colours and guides, and to show the *current effective* value (base data
 * with `app/src/data/overrides/*.json` already applied, since the data
 * modules apply overrides themselves at import time).
 *
 * Run as part of `npm run build` (see app/package.json), so the committed
 * snapshot in `server/content-base.json` never drifts from the source data
 * for more than one build cycle. It is never the source of truth — the `.ts`
 * files and the override JSON remain that — it is a read model for a server
 * that cannot read TypeScript.
 */
import { register } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
register(pathToFileURL(join(__dirname, '..', 'app', 'scripts', 'ts-resolve.mjs')))

const { DEALERS } = await import(pathToFileURL(join(__dirname, '..', 'app', 'src', 'data', 'dealers.ts')))
const { PRODUCTS } = await import(pathToFileURL(join(__dirname, '..', 'app', 'src', 'data', 'products.ts')))
const { COLORS } = await import(pathToFileURL(join(__dirname, '..', 'app', 'src', 'data', 'colors.ts')))
const { GUIDES } = await import(pathToFileURL(join(__dirname, '..', 'app', 'src', 'data', 'guides.ts')))

const snapshot = {
  generatedAt: new Date().toISOString(),
  dealers: DEALERS.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    area: d.area,
    city: d.city,
    state: d.state,
    lat: d.lat,
    lng: d.lng,
    services: d.services,
    verified: d.verified,
    hours: d.hours,
  })),
  products: PRODUCTS.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    finish: p.finish,
    claimsStatus: p.claimsStatus,
    packs: p.packs.map((pack) => ({ size: pack.size, unit: pack.unit, inStock: pack.inStock })),
  })),
  colours: COLORS.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    hex: c.hex,
    family: c.family,
    measuredLrv: c.measuredLrv ?? null,
  })),
  guides: GUIDES.map((g) => ({
    id: g.id,
    title: g.title,
    category: g.category,
    reviewer: g.reviewer,
    updated: g.updated,
  })),
}

const outPath = join(__dirname, '..', 'server', 'content-base.json')
await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
console.log(
  `content snapshot: ${snapshot.dealers.length} dealers, ${snapshot.products.length} products, ` +
    `${snapshot.colours.length} colours, ${snapshot.guides.length} guides -> ${outPath}`,
)
