/**
 * Paint quantity engine.
 *
 * Every function here is pure and covered by `npm run test:calc`
 * (see app/scripts/calculator.test.mjs). The rules encode how a Nigerian
 * contractor actually budgets:
 *   - Coverage is quoted per coat, per litre (or kg), per product.
 *   - Doors and windows are deducted as measured opening areas.
 *   - Skirting, reveals and cutting-in are added as a percentage allowance,
 *     because they are cut in from the same bucket.
 *   - Paint is sold in fixed pack sizes, so we return the cheapest combination
 *     of packs that covers the requirement, plus a 5% site handling allowance.
 */

export type Units = 'metric' | 'imperial'

export type Opening = {
  id: string
  kind: 'door' | 'window' | 'other'
  /** width and height in the selected unit */
  width: number
  height: number
  count: number
}

export type CalculationInput = {
  units: Units
  /** Direct wall-area entry in m² — overrides the perimeter calculation. */
  totalWallArea?: number | null
  roomLength: number
  roomWidth: number
  wallHeight: number
  openings: Opening[]
  coats: number
  includeCeiling: boolean
  /** Extra allowance for skirting, reveals and cutting-in, as a percentage. */
  trimAllowancePct: number
  /** Square metres covered by one litre (or kg) in a single coat. */
  coveragePerUnit: number
  /** Pack sizes in litres (or kg) the product is sold in. */
  packSizes: number[]
  /** Display unit for the recommendation. */
  unit?: 'L' | 'kg'
}

export type PackChoice = { size: number; count: number; amount: number }

export type CalculationResult = {
  wallArea: number
  ceilingArea: number
  openingsArea: number
  trimArea: number
  paintableArea: number
  amountPerCoat: number
  amountTotal: number
  amountWithAllowance: number
  packs: PackChoice[]
  amountBought: number
  surplus: number
  unit: 'L' | 'kg'
  formula: string[]
}

const M2_PER_FT2 = 0.09290304
const HANDLING_ALLOWANCE = 1.05

const round = (n: number, places = 2) => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function toMetres(value: number, units: Units): number {
  return units === 'imperial' ? value * 0.3048 : value
}

export function toSquareMetres(value: number, units: Units): number {
  return units === 'imperial' ? value * M2_PER_FT2 : value
}

export function openingArea(opening: Opening, units: Units): number {
  return toSquareMetres(opening.width * opening.height, units) * Math.max(0, opening.count)
}

/**
 * Largest-first pack selection with a single repair pass. Uses whole packs
 * only — you cannot buy 3.4 litres — and never returns packs that fall short.
 */
export function choosePacks(amount: number, packSizes: number[]): { packs: PackChoice[]; amountBought: number } {
  const sizes = [...packSizes].filter((s) => s > 0).sort((a, b) => b - a)
  if (!sizes.length) return { packs: [], amountBought: 0 }

  const counts = new Map<number, number>()
  let remaining = Math.max(0, amount)

  for (const size of sizes) {
    if (remaining <= 1e-9) break
    const count = Math.floor(remaining / size + 1e-9)
    if (count > 0) {
      counts.set(size, count)
      remaining -= count * size
    }
  }

  if (remaining > 1e-9) {
    const smallest = sizes[sizes.length - 1]
    counts.set(smallest, (counts.get(smallest) ?? 0) + 1)
  }

  // Repair pass: if two small packs would beat one larger pack, take the larger.
  for (let i = 0; i < sizes.length - 1; i += 1) {
    const big = sizes[i]
    const small = sizes[i + 1]
    const smallCount = counts.get(small) ?? 0
    const bigCount = counts.get(big) ?? 0
    const smallTotal = smallCount * small
    if (smallCount > 1 && smallTotal >= big && smallCount * small >= big) {
      counts.set(small, smallCount - Math.floor(big / small))
      counts.set(big, bigCount + 1)
    }
  }

  const packs: PackChoice[] = sizes
    .filter((s) => (counts.get(s) ?? 0) > 0)
    .map((s) => {
      const count = counts.get(s) as number
      return { size: s, count, amount: s * count }
    })

  const amountBought = packs.reduce((sum, p) => sum + p.amount, 0)
  return { packs, amountBought }
}

export function calculate(input: CalculationInput): CalculationResult {
  const unit = input.unit ?? 'L'
  const {
    units,
    totalWallArea,
    roomLength,
    roomWidth,
    wallHeight,
    openings,
    coats,
    includeCeiling,
    trimAllowancePct,
    coveragePerUnit,
    packSizes,
  } = input

  const lengthM = toMetres(roomLength, units)
  const widthM = toMetres(roomWidth, units)
  const heightM = toMetres(wallHeight, units)

  const wallArea =
    typeof totalWallArea === 'number' && totalWallArea > 0 ? totalWallArea : 2 * (lengthM + widthM) * heightM
  const ceilingArea = includeCeiling ? lengthM * widthM : 0
  const openingsArea = openings.reduce((sum, o) => sum + openingArea(o, units), 0)
  const netArea = Math.max(0, wallArea + ceilingArea - openingsArea)
  const trimArea = (netArea * Math.max(0, trimAllowancePct)) / 100
  const paintableArea = netArea + trimArea

  const effectiveCoats = Math.max(1, Math.round(coats))
  const safeCoverage = coveragePerUnit > 0 ? coveragePerUnit : 10
  const amountPerCoat = paintableArea / safeCoverage
  const amountTotal = amountPerCoat * effectiveCoats
  const amountWithAllowance = amountTotal * HANDLING_ALLOWANCE

  const { packs, amountBought } = choosePacks(amountWithAllowance, packSizes)
  const unitLabel = units === 'imperial' ? 'ft' : 'm'

  return {
    wallArea: round(wallArea),
    ceilingArea: round(ceilingArea),
    openingsArea: round(openingsArea),
    trimArea: round(trimArea),
    paintableArea: round(paintableArea),
    amountPerCoat: round(amountPerCoat),
    amountTotal: round(amountTotal),
    amountWithAllowance: round(amountWithAllowance),
    packs,
    amountBought: round(amountBought),
    surplus: round(amountBought - amountWithAllowance),
    unit,
    formula: [
      `Perimeter = 2 × (${round(roomLength)} ${unitLabel} + ${round(roomWidth)} ${unitLabel})`,
      `Wall area = perimeter × ${round(wallHeight)} ${unitLabel} height = ${round(wallArea)} m²`,
      includeCeiling
        ? `Ceiling = ${round(lengthM)} m × ${round(widthM)} m = ${round(ceilingArea)} m²`
        : 'Ceiling excluded',
      `Openings deducted = ${round(openingsArea)} m²`,
      `Trim & cutting-in allowance ${trimAllowancePct}% = ${round(trimArea)} m²`,
      `Paintable area = ${round(paintableArea)} m²`,
      `${unit} per coat = ${round(paintableArea)} m² ÷ ${safeCoverage} m²/${unit} = ${round(amountPerCoat)} ${unit}`,
      `${unit} for ${effectiveCoats} coat${effectiveCoats > 1 ? 's' : ''} + 5% handling = ${round(amountWithAllowance)} ${unit}`,
      `Packs = ${packs.map((p) => `${p.count} × ${p.size} ${unit}`).join(' + ') || 'none'} = ${round(amountBought)} ${unit}`,
    ],
  }
}

