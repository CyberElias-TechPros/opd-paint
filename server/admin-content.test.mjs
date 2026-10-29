/**
 * Content-admin tests — run with `npm test` (node --test server/).
 *
 * Exercises the real HTTP surface against a throwaway snapshot and override
 * directory, so it never touches the real `app/src/data/overrides/*.json`
 * files or the committed `server/content-base.json`.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workDir = mkdtempSync(join(tmpdir(), 'opd-admin-content-'))
const overridesDir = join(workDir, 'overrides')
mkdirSync(overridesDir, { recursive: true })
const snapshotPath = join(workDir, 'content-base.json')

const fixtureSnapshot = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  dealers: [
    {
      id: 'ph-trans-amadi',
      name: 'Trans Amadi trade counter',
      kind: 'Brand trade counter',
      area: 'Trans Amadi',
      city: 'Port Harcourt',
      state: 'Rivers',
      lat: 4.816,
      lng: 7.034,
      services: ['Retail', 'Trade pricing'],
      verified: true,
      hours: 'Mon–Sat, 8:00–18:00',
    },
  ],
  products: [
    {
      id: 'premium-emulsion',
      sku: 'OPD-PE-01',
      name: 'Premium Emulsion',
      finish: 'Matte',
      claimsStatus: 'pending-verification',
      packs: [
        { size: 4, unit: 'L', inStock: true },
        { size: 20, unit: 'L', inStock: false },
      ],
    },
  ],
  colours: [
    { id: 'op-001', code: 'OP-001', name: 'Harbour Mist', hex: '#C7D1CB', family: 'Green', measuredLrv: null },
  ],
  guides: [
    { id: 'surface-prep', title: 'Surface preparation basics', category: 'How-to', reviewer: 'J. Opuda', updated: '2025-01-01' },
  ],
}

writeFileSync(snapshotPath, JSON.stringify(fixtureSnapshot, null, 2))

process.env.OPD_DATA_DIR = mkdtempSync(join(tmpdir(), 'opd-admin-data-'))
process.env.OPD_ADMIN_USER = 'desk'
process.env.OPD_ADMIN_PASSWORD = 'correct horse battery'
process.env.OPD_CONTENT_OVERRIDES_DIR = overridesDir
process.env.OPD_CONTENT_SNAPSHOT_PATH = snapshotPath
delete process.env.OPD_CMS_BACKEND

const { createEnquiryServer } = await import('./index.mjs')

let server
let base

before(async () => {
  server = createEnquiryServer()
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolvePromise) => server.close(resolvePromise))
  rmSync(workDir, { recursive: true, force: true })
  rmSync(process.env.OPD_DATA_DIR, { recursive: true, force: true })
})

const authHeader = { Authorization: `Basic ${Buffer.from('desk:correct horse battery').toString('base64')}` }

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(body),
  })

test('the content admin page requires auth', async () => {
  const res = await fetch(`${base}/admin/content`)
  assert.equal(res.status, 401)
})

test('the content admin page renders for an authenticated request', async () => {
  const res = await fetch(`${base}/admin/content`, { headers: authHeader })
  assert.equal(res.status, 200)
  const html = await res.text()
  assert.match(html, /Trans Amadi trade counter/)
  assert.match(html, /Premium Emulsion/)
  assert.match(html, /Harbour Mist/)
  assert.match(html, /Surface preparation basics/)
})

test('the JSON API requires auth', async () => {
  const res = await fetch(`${base}/api/admin/content`)
  assert.equal(res.status, 401)
})

test('the JSON API returns the effective content for an authenticated request', async () => {
  const res = await fetch(`${base}/api/admin/content`, { headers: authHeader })
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.data.dealers.length, 1)
  assert.equal(body.data.backend, 'fs')
})

test('editing a dealer persists through the fs backend and the override file', async () => {
  const res = await post('/api/admin/content/dealers', {
    action: 'edit',
    id: 'ph-trans-amadi',
    patch: { verified: false, hours: 'Mon–Fri, 9:00–17:00' },
  })
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.data.dealers[0].verified, false)
  assert.equal(body.data.dealers[0].hours, 'Mon–Fri, 9:00–17:00')

  const onDisk = JSON.parse(readFileSync(join(overridesDir, 'dealers.json'), 'utf8'))
  assert.equal(onDisk.edits['ph-trans-amadi'].verified, false)
})

test('editing an unknown dealer is rejected', async () => {
  const res = await post('/api/admin/content/dealers', { action: 'edit', id: 'nope', patch: { verified: true } })
  assert.equal(res.status, 404)
})

test('adding a dealer outside Nigeria is rejected', async () => {
  const res = await post('/api/admin/content/dealers', {
    action: 'add',
    dealer: {
      id: 'lagos-test',
      name: 'Test dealer',
      kind: 'Authorised dealer',
      area: 'Ikeja',
      city: 'Lagos',
      state: 'Lagos',
      lat: 51.5, // London, well outside the Nigeria bounding box
      lng: -0.1,
      services: ['Retail'],
      verified: false,
      hours: 'Mon–Sat',
    },
  })
  const body = await res.json()
  assert.equal(res.status, 422)
  assert.ok(body.fields.lat)
})

test('adding a dealer with a duplicate id is rejected', async () => {
  const res = await post('/api/admin/content/dealers', {
    action: 'add',
    dealer: {
      id: 'ph-trans-amadi',
      name: 'Duplicate',
      kind: 'Authorised dealer',
      area: 'Trans Amadi',
      city: 'Port Harcourt',
      state: 'Rivers',
      lat: 4.8,
      lng: 7.0,
      services: ['Retail'],
      verified: false,
      hours: 'Mon–Sat',
    },
  })
  assert.equal(res.status, 422)
})

test('a valid new dealer is added and later removable', async () => {
  const added = await post('/api/admin/content/dealers', {
    action: 'add',
    dealer: {
      id: 'ph-rumuola',
      name: 'Rumuola dealer',
      kind: 'Authorised dealer',
      area: 'Rumuola',
      city: 'Port Harcourt',
      state: 'Rivers',
      lat: 4.84,
      lng: 7.02,
      services: ['Retail', 'Delivery'],
      verified: false,
      hours: 'Mon–Sat, 9:00–18:00',
    },
  })
  assert.equal(added.status, 200)
  const addedBody = await added.json()
  assert.ok(addedBody.data.dealers.some((d) => d.id === 'ph-rumuola'))

  const removed = await post('/api/admin/content/dealers', { action: 'remove', id: 'ph-rumuola' })
  assert.equal(removed.status, 200)
  const removedBody = await removed.json()
  assert.ok(!removedBody.data.dealers.some((d) => d.id === 'ph-rumuola'))
})

test('product claim status must be a known value', async () => {
  const res = await post('/api/admin/content/products', { productId: 'premium-emulsion', claimsStatus: 'definitely-true' })
  const body = await res.json()
  assert.equal(res.status, 422)
  assert.ok(body.fields.claimsStatus)
})

test('product pack stock rejects an unknown pack size', async () => {
  const res = await post('/api/admin/content/products', { productId: 'premium-emulsion', packInStock: { 900: true } })
  const body = await res.json()
  assert.equal(res.status, 422)
  assert.ok(body.fields.packInStock)
})

test('a valid product update is applied', async () => {
  const res = await post('/api/admin/content/products', {
    productId: 'premium-emulsion',
    claimsStatus: 'label-verified',
    packInStock: { 20: true },
  })
  const body = await res.json()
  assert.equal(res.status, 200)
  const product = body.data.products.find((p) => p.id === 'premium-emulsion')
  assert.equal(product.claimsStatus, 'label-verified')
  assert.equal(product.packs.find((p) => p.size === 20).inStock, true)
})

test('measured LRV must be between 0 and 100', async () => {
  const res = await post('/api/admin/content/colours', { colourId: 'op-001', measuredLrv: 250 })
  assert.equal(res.status, 422)
})

test('measured LRV can be set and cleared', async () => {
  const set = await post('/api/admin/content/colours', { colourId: 'op-001', measuredLrv: 42.5 })
  const setBody = await set.json()
  assert.equal(setBody.data.colours[0].measuredLrv, 42.5)

  const cleared = await post('/api/admin/content/colours', { colourId: 'op-001', measuredLrv: null })
  const clearedBody = await cleared.json()
  assert.equal(clearedBody.data.colours[0].measuredLrv, null)
})

test('guide updated date must look like a date', async () => {
  const res = await post('/api/admin/content/guides', { guideId: 'surface-prep', updated: 'yesterday' })
  assert.equal(res.status, 422)
})

test('a valid guide update is applied', async () => {
  const res = await post('/api/admin/content/guides', { guideId: 'surface-prep', reviewer: 'A. New Reviewer', updated: '2026-02-01' })
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.data.guides[0].reviewer, 'A. New Reviewer')
  assert.equal(body.data.guides[0].updated, '2026-02-01')
})
