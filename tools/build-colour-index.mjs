#!/usr/bin/env node
/**
 * Generate the colour index the enquiry service searches.
 *
 * Why this exists: `/api/search/colours` used to read `app/src/data/colors.ts`
 * and pull ids out of it with a regular expression at request time. That worked
 * on a laptop and failed in every deployment — the runtime container copies
 * `server/` and `app/dist`, not the TypeScript sources, so the endpoint answered
 * 500 "Colour index unavailable" in production while its tests, which run from
 * the repository root, stayed green. It also returned three fields while the
 * client type promised four, so every result from it was missing its hex.
 *
 * The index is now a build artefact, generated from the library the app itself
 * bundles, committed beside the service that reads it, and checked for drift by
 * `npm test`. Regenerate with the build, or by hand:
 *
 *   node --experimental-transform-types tools/build-colour-index.mjs
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { COLORS } from '../app/src/data/colors.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const entries = COLORS.map((colour) => ({
  id: colour.id,
  code: colour.code,
  name: colour.name,
  hex: colour.hex,
  family: colour.family,
})).sort((a, b) => a.code.localeCompare(b.code))

if (!entries.length) {
  console.error('colour index: the library came back empty')
  process.exit(1)
}

const payload = {
  generatedFrom: 'app/src/data/colors.ts',
  generator: 'tools/build-colour-index.mjs',
  count: entries.length,
  colours: entries,
}

await writeFile(join(root, 'server/colour-index.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`colour index: ${entries.length} colours -> server/colour-index.json`)
