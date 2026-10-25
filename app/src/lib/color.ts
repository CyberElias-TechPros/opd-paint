/**
 * Colour utilities.
 *
 * Two honesty rules govern this file:
 *  1. Every colour we publish is stored once, as a single sRGB hex value. RGB is
 *     the only value we can legitimately derive from a label or a screen note —
 *     we never invent spectral data or LRV readings we have not measured.
 *  2. LRV shown in the interface is *estimated* from that sRGB value (CIE Y of
 *     D65 relative luminance). It is labelled as an estimate everywhere it
 *     appears, because a real LRV comes from a spectrophotometer reading of a
 *     dried film, not from a hexadecimal string.
 */

export type RGB = { r: number; g: number; b: number }
export type LAB = { l: number; a: number; b: number }

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '').trim()
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const int = Number.parseInt(full, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** sRGB channel -> linear light (WCAG / CIE definition). */
function toLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Relative luminance, 0..1. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Estimated Light Reflectance Value, 0..100.
 * This is the digital approximation used across the interface and is always
 * presented with a tilde (~) and an explanation.
 */
export function estimateLrv(hex: string): number {
  return Math.round(luminance(hex) * 100)
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** The ink or paper token that is most legible on a given background. */
export function readableInk(bg: string, dark = '#0b1a13', light = '#fcf9f3'): string {
  return contrast(bg, dark) >= contrast(bg, light) ? dark : light
}

/** True when text on this colour should be light. */
export function wantsLightText(bg: string): boolean {
  return contrast(bg, '#0b1a13') < 4.5
}

/** Ink and paper are the only two text colours the design system allows. */
export const INK = '#0b1a13'
export const PAPER = '#fcf9f3'

/**
 * How to put text on a painted surface without guessing.
 *
 * A mid-tone paint (bronze-dust, terracotta, olive-branch) has no text colour
 * that reaches 4.5:1 on the flat swatch — black lands around 4.2, white around
 * 4.3, and neither passes. Small labels on those swatches therefore sit on a
 * solid plate instead of on the paint. This returns the better of the two text
 * colours plus a `plate` flag, so a component never has to work it out inline
 * and can never silently ship unreadable 11px type.
 */
export function swatchText(hex: string): { text: string; plate: boolean } {
  const onPaper = contrast(hex, INK)
  const onWhite = contrast(hex, PAPER)
  const text = onPaper >= onWhite ? INK : PAPER
  return { text, plate: contrast(hex, text) < 4.5 }
}

/* ------------------------------------------------------------------ LAB/D65 */
export function rgbToLab({ r, g, b }: RGB): LAB {
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)
  // sRGB -> XYZ (D65)
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041
  const xn = 0.95047
  const yn = 1
  const zn = 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x / xn)
  const fy = f(y / yn)
  const fz = f(z / zn)
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

export function hexToLab(hex: string): LAB {
  return rgbToLab(hexToRgb(hex))
}

/** CIE76 colour difference — good enough for "are these two swatches close?". */
export function deltaE(hexA: string, hexB: string): number {
  const a = hexToLab(hexA)
  const b = hexToLab(hexB)
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2)
}

/* -------------------------------------------------------------- harmonies */
function toHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6
        break
      case gn:
        h = (bn - rn) / d + 2
        break
      default:
        h = (rn - gn) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

function fromHsl(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360
  const sn = Math.max(0, Math.min(100, s)) / 100
  const ln = Math.max(0, Math.min(100, l)) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1))
  const m = ln - c / 2
  const seg = Math.floor(hn / 60) % 6
  const table: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  const [r, g, b] = table[seg]
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 })
}

/** Nudge a colour's lightness without changing hue/saturation. */
export function shiftLightness(hex: string, delta: number): string {
  const { h, s, l } = toHsl(hex)
  return fromHsl(h, s, l + delta)
}

/** Nudge saturation. */
export function shiftSaturation(hex: string, delta: number): string {
  const { h, s, l } = toHsl(hex)
  return fromHsl(h, s + delta, l)
}

export type Harmony = {
  complementary: string[]
  analogous: string[]
  triadic: string[]
}

/**
 * Editorial pairings. These are computed, not hand-waved: the "analogous"
 * group is the same family rotated in hue with matched lightness, the
 * "complementary" group lifts or drops lightness so the pair stays legible on
 * a wall next to a white ceiling.
 */
export function harmony(hex: string): Harmony {
  const { h, s, l } = toHsl(hex)
  const safeL = Math.min(82, Math.max(22, l))
  return {
    complementary: [
      fromHsl(h + 180, s * 0.85, Math.min(88, safeL + 26)),
      fromHsl(h + 180, s, safeL),
      fromHsl(h + 180, s * 0.7, Math.max(14, safeL - 24)),
    ],
    analogous: [fromHsl(h - 28, s * 0.9, Math.min(90, safeL + 14)), fromHsl(h + 26, s * 0.95, Math.max(12, safeL - 10))],
    triadic: [fromHsl(h + 120, s * 0.8, safeL), fromHsl(h - 120, s * 0.8, safeL)],
  }
}

/* ----------------------------------------------------------------- sorting */
export type SortKey = 'name' | 'lrv-desc' | 'lrv-asc' | 'hue'

export function hueOf(hex: string): number {
  return toHsl(hex).h
}

/** WCAG AA check for a text/background pair, used by the contrast badges. */
export function contrastLabel(ratio: number): { grade: string; passes: 'AA' | 'AA Large' | 'Fail' } {
  if (ratio >= 7) return { grade: 'AAA', passes: 'AA' }
  if (ratio >= 4.5) return { grade: 'AA', passes: 'AA' }
  if (ratio >= 3) return { grade: 'AA Large', passes: 'AA Large' }
  return { grade: 'Fail', passes: 'Fail' }
}
