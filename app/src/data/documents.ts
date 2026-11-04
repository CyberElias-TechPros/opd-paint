/*
 * The downloadable documents, as data rather than markup.
 *
 * Extracted from `routes/Colours.tsx` and `routes/Products.tsx` for the reason
 * `data/legal.ts` gives: a document has one source and several readers. The website
 * renders these links, and the Android app ships the same files in its APK and needs
 * the same titles beside them. ADR 0002 is why that matters — a second copy of these
 * five titles would drift, and a data sheet called one thing on a phone and another
 * thing on the site is not one document with two layouts.
 *
 * `purpose` is the job each document does, in the words the colour page already used
 * in a comment above its own links. They are repeated here rather than invented.
 *
 * `bundled` is false for the master catalogue: 6.2 MB and 126 pages, which
 * `android/app/build.gradle.kts` excludes from the APK and
 * `ContentRepository.documentAsset` returns null for, so the app offers the website's
 * copy instead of pretending it has one.
 */

export type BrandDocument = {
  /** The filename in `app/public/documents`, and the asset path inside the APK. */
  file: string
  /** The path the website links. The app resolves this onto its bundled asset. */
  href: string
  title: string
  /** What the website prints beside the title: the format, and a page count where one is known. */
  detail: string
  /** The job this document does. Absent where the site never states one. */
  purpose?: string
  /** The analytics target the link reports, so the website's events do not change. */
  trackTarget: string
  bundled: boolean
}

const doc = (
  file: string,
  title: string,
  detail: string,
  trackTarget: string,
  purpose?: string,
  bundled = true,
): BrandDocument => ({
  file,
  href: `/documents/${file}`,
  title,
  detail,
  trackTarget,
  bundled,
  // `exactOptionalPropertyTypes` distinguishes "absent" from "present and undefined",
  // so an optional field cannot be assigned unconditionally. Two of the six documents
  // have no stated purpose and the app should see that as no purpose, not an empty one.
  ...(purpose === undefined ? {} : { purpose }),
})

export const COLOUR_BOOK = doc(
  'opudas-colour-book.pdf',
  'Colour book',
  'PDF · 32pp',
  'colours-book',
  'The brochure a customer keeps.',
)

export const ROOM_BOOK = doc(
  'opudas-room-book.pdf',
  'Room book',
  'PDF · 20pp',
  'colours-room-book',
  'The same colours doing actual work on real walls.',
)

export const COLOUR_WHEEL = doc(
  'opudas-colour-wheel.pdf',
  'Colour wheel',
  'PDF · wall chart',
  'colours-wheel',
  'The wall chart a trade counter pins up.',
)

export const FAN_DECK = doc(
  'opudas-fan-deck.pdf',
  'Fan deck',
  'PDF',
  'colours-fandeck',
  'The one-page-a-family reference a painter works from.',
)

/**
 * Not bundled. The app opens the website's copy and says why, which is more useful
 * than a 6.2 MB download on a metered connection that nobody reads on a phone.
 */
export const CATALOGUE = doc(
  'opudas-catalogue.pdf',
  'Full catalogue',
  'PDF · 126pp',
  'colours-catalogue',
  'All of that plus every real site photograph, bound into one file.',
  false,
)

/**
 * The products page called this link "Download the specification sheet". It now reads
 * "Specification sheet", which is what the four colour-page links beside it already do
 * and what the app's index needs: a row in a list of documents is a noun, and the
 * `download` attribute was already doing the verb's work.
 */
export const SPEC_SHEET = doc(
  'opudas-spec-sheet.pdf',
  'Specification sheet',
  'PDF · this table, printable',
  'products-spec-sheet',
)

export const BRAND_DOCUMENTS: BrandDocument[] = [
  COLOUR_BOOK,
  ROOM_BOOK,
  COLOUR_WHEEL,
  FAN_DECK,
  CATALOGUE,
  SPEC_SHEET,
]

export const findDocument = (file: string): BrandDocument | undefined =>
  BRAND_DOCUMENTS.find((document) => document.file === file)
