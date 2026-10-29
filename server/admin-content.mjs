/**
 * The content-admin API and page.
 *
 * Mounted at `/admin/content` (the editor page) and `/api/admin/content*`
 * (the JSON it talks to), behind the same Basic Auth as the enquiry inbox —
 * see `isAdmin()` in `index.mjs`. It edits exactly the fields
 * `docs/remaining-work.md` flags as provisional: dealer verification and
 * details, product claim status and pack availability, measured LRV, and
 * guide review metadata. Everything else in the data model (colour hex,
 * product copy, guide text) is still a deliberate code change, reviewed like
 * any other — this is not a general-purpose CMS, it is the smallest editable
 * surface that covers a real, named gap.
 *
 * See `docs/admin.md` for the full story, including the two persistence
 * backends in `content-store.mjs`.
 */
import { readFile, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cmsBackend, readOverride, writeOverride } from './content-store.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
// Overridable so tests (and anyone running the admin against a checkout laid
// out differently) are not forced to write through the real repo files.
const OVERRIDES_DIR = process.env.OPD_CONTENT_OVERRIDES_DIR || join(REPO_ROOT, 'app', 'src', 'data', 'overrides')
const SNAPSHOT_PATH = process.env.OPD_CONTENT_SNAPSHOT_PATH || join(__dirname, 'content-base.json')

export const OVERRIDE_FILES = {
  dealers: {
    localPath: join(OVERRIDES_DIR, 'dealers.json'),
    repoPath: 'app/src/data/overrides/dealers.json',
    fallback: { edits: {}, additions: [], removed: [] },
  },
  products: {
    localPath: join(OVERRIDES_DIR, 'products.json'),
    repoPath: 'app/src/data/overrides/products.json',
    fallback: { claimsStatus: {}, packInStock: {} },
  },
  colours: {
    localPath: join(OVERRIDES_DIR, 'colours.json'),
    repoPath: 'app/src/data/overrides/colours.json',
    fallback: { measuredLrv: {} },
  },
  guides: {
    localPath: join(OVERRIDES_DIR, 'guides.json'),
    repoPath: 'app/src/data/overrides/guides.json',
    fallback: { edits: {} },
  },
}

const DEALER_KINDS = ['Brand trade counter', 'Authorised dealer', 'Distributor']
const DEALER_SERVICES = ['Retail', 'Trade pricing', 'Colour mixing', 'Delivery', 'Sample pots', 'Site visit']
const CLAIM_STATUSES = ['label-verified', 'pending-verification']
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

let snapshotCache = { key: '', snapshot: null }

async function loadSnapshot() {
  try {
    const info = await stat(SNAPSHOT_PATH)
    const key = `${info.mtimeMs}:${info.size}`
    if (key !== snapshotCache.key) {
      snapshotCache = { key, snapshot: JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8')) }
    }
    return snapshotCache.snapshot
  } catch {
    return { generatedAt: null, dealers: [], products: [], colours: [], guides: [] }
  }
}

/* --------------------------------------------------------- merge (mirrors
   app/src/lib/contentOverrides.ts — see that file for the canonical version
   the site itself builds against; this is the read model for a page the
   TypeScript bundle never ships to. */

function mergeDealers(base, overrides) {
  const removed = new Set(overrides.removed ?? [])
  const edited = base
    .filter((d) => !removed.has(d.id))
    .map((d) => (overrides.edits?.[d.id] ? { ...d, ...overrides.edits[d.id] } : d))
  const additions = (overrides.additions ?? []).filter(
    (a) => !removed.has(a.id) && !edited.some((d) => d.id === a.id),
  )
  return [...edited, ...additions]
}

function mergeProducts(base, overrides) {
  return base.map((p) => {
    const claimsStatus = overrides.claimsStatus?.[p.id] ?? p.claimsStatus
    const stock = overrides.packInStock?.[p.id]
    const packs = stock
      ? p.packs.map((pack) =>
          Object.prototype.hasOwnProperty.call(stock, String(pack.size))
            ? { ...pack, inStock: Boolean(stock[String(pack.size)]) }
            : pack,
        )
      : p.packs
    return { ...p, claimsStatus, packs }
  })
}

function mergeColours(base, overrides) {
  return base.map((c) => {
    const measuredLrv = overrides.measuredLrv?.[c.id]
    return measuredLrv == null ? c : { ...c, measuredLrv }
  })
}

function mergeGuides(base, overrides) {
  return base.map((g) => (overrides.edits?.[g.id] ? { ...g, ...overrides.edits[g.id] } : g))
}

async function effectiveContent() {
  const snapshot = await loadSnapshot()
  const [dealerOverrides, productOverrides, colourOverrides, guideOverrides] = await Promise.all([
    readOverride(OVERRIDE_FILES.dealers, OVERRIDE_FILES.dealers.fallback),
    readOverride(OVERRIDE_FILES.products, OVERRIDE_FILES.products.fallback),
    readOverride(OVERRIDE_FILES.colours, OVERRIDE_FILES.colours.fallback),
    readOverride(OVERRIDE_FILES.guides, OVERRIDE_FILES.guides.fallback),
  ])
  return {
    generatedAt: snapshot.generatedAt,
    backend: cmsBackend(),
    dealers: mergeDealers(snapshot.dealers, dealerOverrides),
    products: mergeProducts(snapshot.products, productOverrides),
    colours: mergeColours(snapshot.colours, colourOverrides),
    guides: mergeGuides(snapshot.guides, guideOverrides),
  }
}

/* --------------------------------------------------------------- validation */

const str = (v) => (typeof v === 'string' ? v.trim() : '')

function validateDealerPatch(patch, { requireAll }) {
  const errors = {}
  const out = {}
  const has = (key) => Object.prototype.hasOwnProperty.call(patch, key)

  if (requireAll || has('name')) {
    out.name = str(patch.name)
    if (!out.name) errors.name = 'Name is required.'
  }
  if (requireAll || has('kind')) {
    out.kind = patch.kind
    if (!DEALER_KINDS.includes(out.kind)) errors.kind = `Kind must be one of: ${DEALER_KINDS.join(', ')}.`
  }
  if (requireAll || has('area')) {
    out.area = str(patch.area)
    if (!out.area) errors.area = 'Area is required.'
  }
  if (requireAll || has('city')) {
    out.city = str(patch.city) || 'Port Harcourt'
  }
  if (requireAll || has('state')) {
    out.state = str(patch.state) || 'Rivers'
  }
  if (requireAll || has('lat')) {
    out.lat = Number(patch.lat)
    if (!Number.isFinite(out.lat) || out.lat <= 3.8 || out.lat >= 13.9) errors.lat = 'Latitude must be inside Nigeria.'
  }
  if (requireAll || has('lng')) {
    out.lng = Number(patch.lng)
    if (!Number.isFinite(out.lng) || out.lng <= 2.6 || out.lng >= 14.7) errors.lng = 'Longitude must be inside Nigeria.'
  }
  if (requireAll || has('services')) {
    const services = Array.isArray(patch.services) ? patch.services : []
    out.services = services.filter((s) => DEALER_SERVICES.includes(s))
    if (!out.services.length) errors.services = `Pick at least one of: ${DEALER_SERVICES.join(', ')}.`
  }
  if (requireAll || has('verified')) {
    out.verified = Boolean(patch.verified)
  }
  if (requireAll || has('hours')) {
    out.hours = str(patch.hours) || 'Call ahead to confirm hours.'
  }
  return { out, errors }
}

/* -------------------------------------------------------------- JSON body */

async function readJsonBody(req, limitBytes = 32 * 1024) {
  return new Promise((resolvePromise, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        chunks.length = 0
        req.resume()
        reject(new Error('Payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Malformed JSON'))
      }
    })
    req.on('error', reject)
  })
}

/* --------------------------------------------------------------- handlers */

export async function handleAdminContentApi(req, res, path, send) {
  if (path === '/api/admin/content' && req.method === 'GET') {
    send(res, 200, { ok: true, data: await effectiveContent() })
    return true
  }

  if (path === '/api/admin/content/dealers' && req.method === 'POST') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      send(res, 400, { ok: false, error: 'Malformed request.' })
      return true
    }
    const overrides = await readOverride(OVERRIDE_FILES.dealers, OVERRIDE_FILES.dealers.fallback)
    const snapshot = await loadSnapshot()
    const currentIds = new Set(mergeDealers(snapshot.dealers, overrides).map((d) => d.id))

    if (body.action === 'add') {
      const id = str(body.dealer?.id).toLowerCase()
      if (!ID_PATTERN.test(id)) {
        send(res, 422, { ok: false, error: 'Dealer id must be lowercase, hyphenated (e.g. "ph-rumuola").', fields: { id: 'Invalid id.' } })
        return true
      }
      if (currentIds.has(id)) {
        send(res, 422, { ok: false, error: 'That dealer id already exists.', fields: { id: 'Already in use.' } })
        return true
      }
      const { out, errors } = validateDealerPatch(body.dealer ?? {}, { requireAll: true })
      if (Object.keys(errors).length) {
        send(res, 422, { ok: false, error: 'Check the highlighted fields.', fields: errors })
        return true
      }
      overrides.additions = [...(overrides.additions ?? []), { id, ...out }]
      overrides.removed = (overrides.removed ?? []).filter((r) => r !== id)
      await writeOverride(OVERRIDE_FILES.dealers, overrides, `admin: add dealer ${id}`)
      send(res, 200, { ok: true, data: { dealers: mergeDealers(snapshot.dealers, overrides) } })
      return true
    }

    if (body.action === 'edit') {
      const id = str(body.id)
      if (!currentIds.has(id)) {
        send(res, 404, { ok: false, error: 'Unknown dealer id.' })
        return true
      }
      const { out, errors } = validateDealerPatch(body.patch ?? {}, { requireAll: false })
      if (Object.keys(errors).length) {
        send(res, 422, { ok: false, error: 'Check the highlighted fields.', fields: errors })
        return true
      }
      overrides.edits = { ...(overrides.edits ?? {}), [id]: { ...(overrides.edits?.[id] ?? {}), ...out } }
      await writeOverride(OVERRIDE_FILES.dealers, overrides, `admin: edit dealer ${id}`)
      send(res, 200, { ok: true, data: { dealers: mergeDealers(snapshot.dealers, overrides) } })
      return true
    }

    if (body.action === 'remove') {
      const id = str(body.id)
      if (!currentIds.has(id)) {
        send(res, 404, { ok: false, error: 'Unknown dealer id.' })
        return true
      }
      overrides.removed = [...new Set([...(overrides.removed ?? []), id])]
      overrides.additions = (overrides.additions ?? []).filter((a) => a.id !== id)
      await writeOverride(OVERRIDE_FILES.dealers, overrides, `admin: remove dealer ${id}`)
      send(res, 200, { ok: true, data: { dealers: mergeDealers(snapshot.dealers, overrides) } })
      return true
    }

    send(res, 400, { ok: false, error: 'Unknown action. Use "add", "edit" or "remove".' })
    return true
  }

  if (path === '/api/admin/content/products' && req.method === 'POST') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      send(res, 400, { ok: false, error: 'Malformed request.' })
      return true
    }
    const snapshot = await loadSnapshot()
    const product = snapshot.products.find((p) => p.id === body.productId)
    if (!product) {
      send(res, 404, { ok: false, error: 'Unknown product id.' })
      return true
    }
    const overrides = await readOverride(OVERRIDE_FILES.products, OVERRIDE_FILES.products.fallback)
    const errors = {}
    if (body.claimsStatus !== undefined) {
      if (!CLAIM_STATUSES.includes(body.claimsStatus)) errors.claimsStatus = `Must be one of: ${CLAIM_STATUSES.join(', ')}.`
    }
    const knownSizes = new Set(product.packs.map((p) => String(p.size)))
    if (body.packInStock !== undefined) {
      if (typeof body.packInStock !== 'object' || body.packInStock === null) {
        errors.packInStock = 'Must be an object keyed by pack size.'
      } else {
        for (const size of Object.keys(body.packInStock)) {
          if (!knownSizes.has(size)) errors.packInStock = `${product.id} has no ${size} pack.`
        }
      }
    }
    if (Object.keys(errors).length) {
      send(res, 422, { ok: false, error: 'Check the highlighted fields.', fields: errors })
      return true
    }
    if (body.claimsStatus !== undefined) {
      overrides.claimsStatus = { ...(overrides.claimsStatus ?? {}), [product.id]: body.claimsStatus }
    }
    if (body.packInStock !== undefined) {
      const existing = overrides.packInStock?.[product.id] ?? {}
      const merged = { ...existing }
      for (const [size, inStock] of Object.entries(body.packInStock)) merged[size] = Boolean(inStock)
      overrides.packInStock = { ...(overrides.packInStock ?? {}), [product.id]: merged }
    }
    await writeOverride(OVERRIDE_FILES.products, overrides, `admin: update product ${product.id}`)
    send(res, 200, { ok: true, data: { products: mergeProducts(snapshot.products, overrides) } })
    return true
  }

  if (path === '/api/admin/content/colours' && req.method === 'POST') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      send(res, 400, { ok: false, error: 'Malformed request.' })
      return true
    }
    const snapshot = await loadSnapshot()
    const colour = snapshot.colours.find((c) => c.id === body.colourId)
    if (!colour) {
      send(res, 404, { ok: false, error: 'Unknown colour id.' })
      return true
    }
    const value = body.measuredLrv
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) {
      send(res, 422, { ok: false, error: 'measuredLrv must be a number from 0 to 100, or null to clear it.', fields: { measuredLrv: 'Invalid value.' } })
      return true
    }
    const overrides = await readOverride(OVERRIDE_FILES.colours, OVERRIDE_FILES.colours.fallback)
    const measuredLrv = { ...(overrides.measuredLrv ?? {}) }
    if (value === null) delete measuredLrv[colour.id]
    else measuredLrv[colour.id] = value
    overrides.measuredLrv = measuredLrv
    await writeOverride(OVERRIDE_FILES.colours, overrides, `admin: measured LRV for ${colour.id}`)
    send(res, 200, { ok: true, data: { colours: mergeColours(snapshot.colours, overrides) } })
    return true
  }

  if (path === '/api/admin/content/guides' && req.method === 'POST') {
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      send(res, 400, { ok: false, error: 'Malformed request.' })
      return true
    }
    const snapshot = await loadSnapshot()
    const guide = snapshot.guides.find((g) => g.id === body.guideId)
    if (!guide) {
      send(res, 404, { ok: false, error: 'Unknown guide id.' })
      return true
    }
    const errors = {}
    const patch = {}
    if (body.reviewer !== undefined) {
      patch.reviewer = str(body.reviewer).slice(0, 160)
      if (!patch.reviewer) errors.reviewer = 'Reviewer is required.'
    }
    if (body.updated !== undefined) {
      patch.updated = str(body.updated)
      if (!DATE_PATTERN.test(patch.updated)) errors.updated = 'Use the format YYYY-MM-DD.'
    }
    if (Object.keys(errors).length) {
      send(res, 422, { ok: false, error: 'Check the highlighted fields.', fields: errors })
      return true
    }
    const overrides = await readOverride(OVERRIDE_FILES.guides, OVERRIDE_FILES.guides.fallback)
    overrides.edits = { ...(overrides.edits ?? {}), [guide.id]: { ...(overrides.edits?.[guide.id] ?? {}), ...patch } }
    await writeOverride(OVERRIDE_FILES.guides, overrides, `admin: update guide ${guide.id}`)
    send(res, 200, { ok: true, data: { guides: mergeGuides(snapshot.guides, overrides) } })
    return true
  }

  return false
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function renderContentAdminPage() {
  const content = await effectiveContent()
  const backendNote =
    content.backend === 'github'
      ? 'Saves commit directly to the repository (GitHub-backed) and trigger a normal deploy.'
      : 'Saves write to local disk. On a serverless host this does not persist across deploys — set OPD_CMS_BACKEND=github to commit to the repo instead.'

  return `<!doctype html>
<html lang="en-NG">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Content admin — OPUDA'S PAINT</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2rem clamp(1rem, 4vw, 3rem) 5rem; background: #f7f2e9; color: #0b1a13;
         font: 15px/1.55 "Archivo", ui-sans-serif, system-ui, sans-serif; }
  h1 { font: 400 clamp(1.8rem, 4vw, 2.6rem)/1.05 "Instrument Serif", Georgia, serif; margin: 0 0 .4rem; }
  h2 { font: 600 1.15rem/1.2 "Archivo", sans-serif; margin: 2.4rem 0 .2rem; }
  p.lede { margin: 0 0 1.2rem; color: #4d6157; max-width: 48rem; }
  .note { border: 1px solid #d8cdbb; background: #fcf9f3; border-radius: 3px; padding: .7rem 1rem; font-size: .82rem; color: #4d6157; margin-bottom: 1.6rem; }
  table { border-collapse: collapse; width: 100%; background: #fcf9f3; border: 1px solid #d8cdbb; margin-top: .6rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #e6ddcf; vertical-align: top; font-size: .82rem; }
  thead th { background: #0b1a13; color: #fcf9f3; font-size: .64rem; letter-spacing: .1em; text-transform: uppercase; }
  input, select { font: inherit; font-size: .82rem; padding: .3rem .4rem; border: 1px solid #c9bda6; border-radius: 3px; background: #fff; width: 100%; }
  input[type="checkbox"] { width: auto; }
  button { font: inherit; font-weight: 700; font-size: .78rem; letter-spacing: .02em; border: 1px solid #0b1a13;
           border-radius: 3px; padding: .45rem .8rem; background: #0c6b45; color: #fcf9f3; cursor: pointer; }
  button.ghost { background: transparent; color: #0b1a13; }
  button.danger { background: #b4121f; border-color: #b4121f; }
  .row-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
  .status { font-size: .78rem; margin-top: .3rem; min-height: 1.1em; }
  .status.ok { color: #0c6b45; }
  .status.err { color: #b4121f; }
  .add-form { margin-top: 1rem; border: 1px dashed #c9bda6; border-radius: 3px; padding: 1rem; background: #fcf9f3; }
  .add-form .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .6rem; margin-bottom: .6rem; }
  .add-form label { display: block; font-size: .68rem; text-transform: uppercase; letter-spacing: .08em; color: #4d6157; margin-bottom: .2rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; }
  .pill { display: inline-block; border-radius: 99px; padding: .1rem .55rem; font-size: .7rem; font-weight: 700; }
  .pill.yes { background: #dcecd8; color: #0c6b45; }
  .pill.no { background: #f3dede; color: #8c1420; }
  .actions-top { display: flex; gap: .6rem; margin-bottom: 1rem; }
  .actions-top a { border: 1px solid #0b1a13; border-radius: 3px; padding: .45rem .8rem; text-decoration: none; color: #0b1a13; font-size: .8rem; font-weight: 600; }
</style>
</head>
<body>
  <h1>Content admin</h1>
  <p class="lede">Edit exactly the fields the roadmap calls provisional — dealer details, product claim status and
    pack stock, measured LRV, guide review metadata — without touching TypeScript. Everything else in the catalogue
    stays a code review, on purpose.</p>
  <div class="note">${escapeHtml(backendNote)} Snapshot generated ${escapeHtml(content.generatedAt ?? 'never — run `npm run build`')}.</div>
  <div class="actions-top">
    <a href="/admin">Enquiries inbox</a>
    <a href="/">Open the site</a>
  </div>

  <h2>Dealers (${content.dealers.length})</h2>
  <table id="dealers-table">
    <thead><tr><th>Name</th><th>Area</th><th>Kind</th><th>Verified</th><th>Hours</th><th>Services</th><th></th></tr></thead>
    <tbody>
      ${content.dealers
        .map(
          (d) => `<tr data-id="${escapeHtml(d.id)}">
        <td><input data-field="name" value="${escapeHtml(d.name)}"></td>
        <td><input data-field="area" value="${escapeHtml(d.area)}"></td>
        <td><select data-field="kind">${DEALER_KINDS.map((k) => `<option ${k === d.kind ? 'selected' : ''}>${escapeHtml(k)}</option>`).join('')}</select></td>
        <td><input type="checkbox" data-field="verified" ${d.verified ? 'checked' : ''}></td>
        <td><input data-field="hours" value="${escapeHtml(d.hours)}"></td>
        <td><input data-field="services" value="${escapeHtml((d.services ?? []).join(', '))}" title="Comma-separated: ${DEALER_SERVICES.join(', ')}"></td>
        <td class="row-actions">
          <button data-action="save-dealer">Save</button>
          <button class="danger" data-action="remove-dealer">Remove</button>
        </td>
      </tr>
      <tr><td colspan="7" class="status" id="status-dealer-${escapeHtml(d.id)}"></td></tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <div class="add-form">
    <strong>Add a dealer</strong>
    <div class="grid" style="margin-top:.6rem">
      <div><label>Id</label><input id="new-dealer-id" placeholder="ph-rumuola"></div>
      <div><label>Name</label><input id="new-dealer-name" placeholder="Authorised dealer — Rumuola"></div>
      <div><label>Area</label><input id="new-dealer-area" placeholder="Rumuola"></div>
      <div><label>Kind</label><select id="new-dealer-kind">${DEALER_KINDS.map((k) => `<option>${escapeHtml(k)}</option>`).join('')}</select></div>
      <div><label>Lat</label><input id="new-dealer-lat" placeholder="4.82"></div>
      <div><label>Lng</label><input id="new-dealer-lng" placeholder="7.02"></div>
      <div><label>Hours</label><input id="new-dealer-hours" placeholder="Mon–Sat, 8:00–18:00"></div>
      <div><label>Services</label><input id="new-dealer-services" placeholder="Retail, Delivery"></div>
      <div><label>Verified</label><input type="checkbox" id="new-dealer-verified"></div>
    </div>
    <button data-action="add-dealer">Add dealer</button>
    <p class="status" id="status-new-dealer"></p>
  </div>

  <h2>Products (${content.products.length})</h2>
  <table>
    <thead><tr><th>Product</th><th>Claim status</th><th>Pack stock</th><th></th></tr></thead>
    <tbody>
      ${content.products
        .map(
          (p) => `<tr data-id="${escapeHtml(p.id)}">
        <td><strong>${escapeHtml(p.name)}</strong><br><span style="color:#4d6157">${escapeHtml(p.sku)}</span></td>
        <td><select data-field="claimsStatus">${CLAIM_STATUSES.map((s) => `<option value="${s}" ${s === p.claimsStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td>${p.packs
          .map(
            (pack) =>
              `<label style="display:inline-flex;align-items:center;gap:.25rem;margin-right:.6rem"><input type="checkbox" data-pack-size="${pack.size}" ${pack.inStock ? 'checked' : ''}> ${pack.size}${pack.unit}</label>`,
          )
          .join('')}</td>
        <td><button data-action="save-product">Save</button></td>
      </tr>
      <tr><td colspan="4" class="status" id="status-product-${escapeHtml(p.id)}"></td></tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <h2>Colours — measured LRV (${content.colours.length})</h2>
  <p class="lede" style="margin-top:0">Leave blank to keep the estimate derived from the hex value.</p>
  <table>
    <thead><tr><th>Colour</th><th>Hex</th><th>Measured LRV</th><th></th></tr></thead>
    <tbody>
      ${content.colours
        .map(
          (c) => `<tr data-id="${escapeHtml(c.id)}">
        <td>${escapeHtml(c.name)} <span style="color:#4d6157">${escapeHtml(c.code)}</span></td>
        <td><span style="display:inline-block;width:1.1em;height:1.1em;border-radius:2px;background:${escapeHtml(c.hex)};vertical-align:middle;border:1px solid #0002"></span> <code>${escapeHtml(c.hex)}</code></td>
        <td><input data-field="measuredLrv" type="number" min="0" max="100" step="0.1" value="${c.measuredLrv == null ? '' : c.measuredLrv}" style="width:6rem"></td>
        <td><button data-action="save-colour">Save</button></td>
      </tr>
      <tr><td colspan="4" class="status" id="status-colour-${escapeHtml(c.id)}"></td></tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <h2>Guides — review metadata (${content.guides.length})</h2>
  <table>
    <thead><tr><th>Guide</th><th>Reviewer</th><th>Updated</th><th></th></tr></thead>
    <tbody>
      ${content.guides
        .map(
          (g) => `<tr data-id="${escapeHtml(g.id)}">
        <td>${escapeHtml(g.title)}</td>
        <td><input data-field="reviewer" value="${escapeHtml(g.reviewer)}"></td>
        <td><input data-field="updated" value="${escapeHtml(g.updated)}" placeholder="YYYY-MM-DD"></td>
        <td><button data-action="save-guide">Save</button></td>
      </tr>
      <tr><td colspan="4" class="status" id="status-guide-${escapeHtml(g.id)}"></td></tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <footer style="margin-top:2.5rem;color:#4d6157;font-size:.78rem;max-width:52rem">
    Edits are written to <code>app/src/data/overrides/*.json</code> and applied by
    <code>src/lib/contentOverrides.ts</code> the next time the site is built. They do not change the typed data
    files themselves, and every existing content-integrity test still runs against the result.
  </footer>

<script>
(function () {
  function status(id, ok, message) {
    var el = document.getElementById('status-' + id)
    if (!el) return
    el.textContent = message
    el.className = 'status ' + (ok ? 'ok' : 'err')
  }

  async function post(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({ ok: false, error: 'Malformed response' }))
    return { ok: res.ok, data }
  }

  document.body.addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-action]')
    if (!button) return
    const action = button.dataset.action
    const row = button.closest('tr')

    if (action === 'save-dealer' || action === 'remove-dealer') {
      const id = row.dataset.id
      if (action === 'remove-dealer') {
        if (!confirm('Remove dealer "' + id + '" from the published list?')) return
        const { ok, data } = await post('/api/admin/content/dealers', { action: 'remove', id })
        status('dealer-' + id, ok && data.ok, ok && data.ok ? 'Removed. Reload to confirm.' : data.error || 'Failed.')
        if (ok && data.ok) row.style.opacity = '0.4'
        return
      }
      const patch = {
        name: row.querySelector('[data-field="name"]').value,
        area: row.querySelector('[data-field="area"]').value,
        kind: row.querySelector('[data-field="kind"]').value,
        verified: row.querySelector('[data-field="verified"]').checked,
        hours: row.querySelector('[data-field="hours"]').value,
        services: row.querySelector('[data-field="services"]').value.split(',').map((s) => s.trim()).filter(Boolean),
      }
      const { ok, data } = await post('/api/admin/content/dealers', { action: 'edit', id, patch })
      status('dealer-' + id, ok && data.ok, ok && data.ok ? 'Saved.' : (data.error || 'Failed.') + (data.fields ? ' ' + JSON.stringify(data.fields) : ''))
      return
    }

    if (action === 'add-dealer') {
      const dealer = {
        id: document.getElementById('new-dealer-id').value,
        name: document.getElementById('new-dealer-name').value,
        area: document.getElementById('new-dealer-area').value,
        kind: document.getElementById('new-dealer-kind').value,
        lat: Number(document.getElementById('new-dealer-lat').value),
        lng: Number(document.getElementById('new-dealer-lng').value),
        hours: document.getElementById('new-dealer-hours').value,
        services: document.getElementById('new-dealer-services').value.split(',').map((s) => s.trim()).filter(Boolean),
        verified: document.getElementById('new-dealer-verified').checked,
      }
      const { ok, data } = await post('/api/admin/content/dealers', { action: 'add', dealer })
      status('new-dealer', ok && data.ok, ok && data.ok ? 'Added. Reload to see it in the table.' : (data.error || 'Failed.') + (data.fields ? ' ' + JSON.stringify(data.fields) : ''))
      return
    }

    if (action === 'save-product') {
      const id = row.dataset.id
      const claimsStatus = row.querySelector('[data-field="claimsStatus"]').value
      const packInStock = {}
      row.querySelectorAll('[data-pack-size]').forEach((el) => { packInStock[el.dataset.packSize] = el.checked })
      const { ok, data } = await post('/api/admin/content/products', { productId: id, claimsStatus, packInStock })
      status('product-' + id, ok && data.ok, ok && data.ok ? 'Saved.' : data.error || 'Failed.')
      return
    }

    if (action === 'save-colour') {
      const id = row.dataset.id
      const raw = row.querySelector('[data-field="measuredLrv"]').value
      const measuredLrv = raw === '' ? null : Number(raw)
      const { ok, data } = await post('/api/admin/content/colours', { colourId: id, measuredLrv })
      status('colour-' + id, ok && data.ok, ok && data.ok ? 'Saved.' : data.error || 'Failed.')
      return
    }

    if (action === 'save-guide') {
      const id = row.dataset.id
      const reviewer = row.querySelector('[data-field="reviewer"]').value
      const updated = row.querySelector('[data-field="updated"]').value
      const { ok, data } = await post('/api/admin/content/guides', { guideId: id, reviewer, updated })
      status('guide-' + id, ok && data.ok, ok && data.ok ? 'Saved.' : data.error || 'Failed.')
      return
    }
  })
})()
</script>
</body>
</html>`
}
