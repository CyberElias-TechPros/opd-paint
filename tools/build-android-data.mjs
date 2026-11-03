#!/usr/bin/env node
/**
 * Generate the content bundle the Android app ships inside its APK.
 *
 * Why this exists rather than a Kotlin copy of the data:
 *
 * `docs/adr/0002-typed-data-over-a-cms.md` says the typed modules under
 * `app/src/data/` are the single source of truth, and that every consumer — the
 * site, the enquiry service's colour index, the Python document generators —
 * reads from them. A native app is another consumer, not another source. Porting
 * 59 colours, 6 products, 9 palettes, 19 projects, 6 guides, 14 dealers, three legal notices and the
 * ten preparation situations into Kotlin by hand would create a second copy that
 * drifts the first time somebody edits a colour, and the drift would be invisible
 * until a customer quotes a code that no longer exists.
 *
 * So: the data is serialised to JSON at build time, committed beside the app that
 * reads it (like `server/colour-index.json`, so the APK can be built without
 * running Node), and checked for drift by `tools/check-assets.py` in CI.
 *
 * What is *not* serialised is behaviour. The quantity engine, the finish-finder
 * rule table, the checklist builder, the share-link codec and the colour maths
 * are ported to Kotlin and tested there against the same cases the TypeScript
 * tests assert — because a rule table read from JSON is a rule table nobody type
 * checks, and the point of the advisor is that its reasoning is exhaustive and
 * proven, not configurable.
 *
 * Output is deterministic: no timestamps, no host-specific paths, stable key
 * order. Two runs on two machines produce identical bytes, which is what makes
 * the drift check meaningful.
 *
 *   node --experimental-transform-types --no-warnings \
 *        --import ./app/scripts/register.mjs tools/build-android-data.mjs
 *
 * or, from `app/`:  npm run data:android
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  COLORS,
  COLLECTIONS,
  COLOR_LRV,
  FAMILIES,
  FAMILY_SWATCH,
  ROOMS,
} from '../app/src/data/colors.ts'
import { ALT, getImage, imageKeys } from '../app/src/lib/media.ts'
import {
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_TEL,
  DEALERS,
  SERVICES,
  STATES,
  WHATSAPP_NUMBER,
} from '../app/src/data/dealers.ts'
import { CATEGORIES, GUIDES } from '../app/src/data/guides.ts'
import { LEGAL_DOCS } from '../app/src/data/legal.ts'
import { PALETTES } from '../app/src/data/palettes.ts'
import { FINISH_SHEEN_LABEL, PRODUCTS } from '../app/src/data/products.ts'
import { PROJECTS } from '../app/src/data/projects.ts'
import {
  CONDITION_OPTIONS,
  FINISH_QUESTIONS,
  OPTIONS_FOR,
  PREP_SITUATIONS,
  SHEEN_OPTIONS,
  SURFACE_OPTIONS,
  TOOL_CARDS,
  WEAR_OPTIONS,
} from '../app/src/data/tools.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'android', 'app', 'src', 'main', 'assets', 'data')
const themeCss = join(root, 'app', 'src', 'styles', 'theme.css')

/**
 * JSON with two-space indentation and a trailing newline.
 *
 * `JSON.stringify` preserves insertion order, and the source modules declare
 * their fields in a fixed order, so this is reproducible without sorting keys —
 * sorting would also throw away the reading order the data was written in.
 */
const json = (value) => `${JSON.stringify(value, null, 2)}\n`

/* ------------------------------------------------------------------ theme */

/**
 * The design tokens, read out of `theme.css`.
 *
 * The app's colours are the brand's colours, and the brand's colours live in one
 * file. Emitting them means a token change on the website changes the app in the
 * same commit, and a CI check catches it if somebody forgets to regenerate.
 *
 * The comments in `theme.css` carry measured contrast ratios — the reason each
 * token exists. They are not parseable into JSON, so they stay where they are
 * and the Kotlin theme points back at this file.
 */
async function readTheme() {
  const css = await readFile(themeCss, 'utf8')
  const token = (prefix) => {
    const found = {}
    const pattern = new RegExp(`--${prefix}-([a-z0-9-]+)\\s*:\\s*([^;]+);`, 'g')
    for (const match of css.matchAll(pattern)) {
      found[match[1]] = match[2].trim()
    }
    return found
  }

  const colors = token('color')
  const radiiPx = token('radius')

  // A design token in px becomes a dp on Android: both are "one unit at the
  // reference density", and the radii here are small enough that the difference
  // is invisible. Documented rather than converted, because converting would
  // imply a precision the tokens do not have.
  const radii = {}
  for (const [name, value] of Object.entries(radiiPx)) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) radii[name] = parsed
  }

  const firstFamily = (stack) =>
    String(stack)
      .split(',')[0]
      .trim()
      .replace(/^['"]|['"]$/g, '')

  return {
    colors,
    radii,
    fonts: {
      /*
       * The website asks for Instrument Serif and Archivo Variable and falls
       * back to the system's serif and sans-serif; no font files are committed
       * to this repository. The app ships the same fallback and says so, rather
       * than silently substituting a different face: bundling a licensed webfont
       * is a decision with a licence attached, not a build step.
       */
      display: { web: firstFamily(css.match(/--font-display:\s*([^;]+);/)?.[1] ?? ''), android: 'serif' },
      sans: { web: firstFamily(css.match(/--font-sans:\s*([^;]+);/)?.[1] ?? ''), android: 'sans-serif' },
    },
  }
}

/* ----------------------------------------------------------------- output */

/**
 * A web path becomes an asset path.
 *
 * `/media/x.webp` is a URL against a site root; inside an APK the same file is
 * `media/x.webp` under `assets/`, and a leading slash makes Android look for a
 * file that does not exist. Stripping it here means the app never has to know
 * that the manifest was written for a browser.
 */
const assetPath = (path) => String(path ?? '').replace(/^\/+/, '')

const bundles = async () => ({
  /*
   * The image manifest merged with its alt text.
   *
   * Alt text is content in this repository (`app/src/lib/media.ts`, roadmap
   * 09.02.02), reviewed in one place, and an image with no description is an
   * image a TalkBack user cannot use. Shipping it in the same bundle as the
   * dimensions means the app cannot render one without the other.
   *
   * `lqip` is deliberately dropped: it is a base64 WebP blur placeholder for a
   * browser painting something while the real file arrives. Compose shows the
   * image's own `tint` as the placeholder instead, which costs no bytes.
   */
  media: {
    images: Object.fromEntries(
      imageKeys.map((key) => {
        const entry = getImage(key)
        return [
          key,
          {
            src: assetPath(entry.src),
            thumb: assetPath(entry.thumb),
            width: entry.width,
            height: entry.height,
            aspect: entry.aspect,
            tint: entry.tint,
            alt: ALT[key] ?? '',
          },
        ]
      }),
    ),
  },
  /*
   * LRV is emitted per colour rather than ported: `COLOR_LRV` falls back to an
   * estimate from the hex when a colour has no measured value, and the app has
   * no business carrying a second copy of that estimator.
   */
  colors: {
    colors: COLORS.map((color) => ({ ...color, lrv: COLOR_LRV(color) })),
    families: FAMILIES,
    rooms: ROOMS,
    collections: COLLECTIONS,
    familySwatch: FAMILY_SWATCH,
  },
  products: { products: PRODUCTS, sheenLabels: FINISH_SHEEN_LABEL },
  palettes: { palettes: PALETTES },
  projects: { projects: PROJECTS },
  guides: { guides: GUIDES, categories: CATEGORIES },
  /*
   * The three legal notices.
   *
   * Shipped rather than fetched. Somebody exercising a data right on a plane, or in
   * a basement with one bar of signal, should be able to read what they are entitled
   * to without a network. A notice that only exists behind a request is unavailable
   * exactly when it is most needed, and the app now has a form that submits a
   * statutory request — the notice that explains it has to be reachable offline too.
   */
  legal: { docs: LEGAL_DOCS },
  dealers: {
    dealers: DEALERS,
    states: STATES,
    services: SERVICES,
    contact: {
      phoneDisplay: BRAND_PHONE_DISPLAY,
      phoneTel: BRAND_PHONE_TEL,
      whatsapp: WHATSAPP_NUMBER,
    },
  },
  tools: {
    surfaceOptions: SURFACE_OPTIONS,
    conditionOptions: CONDITION_OPTIONS,
    wearOptions: WEAR_OPTIONS,
    sheenOptions: SHEEN_OPTIONS,
    finishQuestions: FINISH_QUESTIONS,
    optionsFor: OPTIONS_FOR,
    prepSituations: PREP_SITUATIONS,
    toolCards: TOOL_CARDS,
  },
  theme: await readTheme(),
})

const main = async () => {
  await mkdir(outDir, { recursive: true })
  const written = []
  for (const [name, value] of Object.entries(await bundles())) {
    const file = join(outDir, `${name}.json`)
    await writeFile(file, json(value), 'utf8')
    written.push(`${name}.json`)
  }
  console.log(`android content bundle: ${written.length} files → android/app/src/main/assets/data`)
  for (const name of written) console.log(`  ${name}`)
}

await main()
