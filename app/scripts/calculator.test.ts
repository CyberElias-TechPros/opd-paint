/**
 * Calculator unit tests — run with `npm run test:calc`.
 *
 * These use worked examples computed by hand, not by the implementation, so a
 * regression in the arithmetic is caught rather than blessed. Node 22 strips the
 * TypeScript types natively; no test framework is needed for a pure module.
 */
import assert from 'node:assert/strict'
import { calculate, choosePacks, openingArea, toMetres, toSquareMetres } from '../src/lib/calculator.ts'

let passed = 0
const test = (name, fn) => {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    console.error(`  FAIL ${name}`)
    console.error(error.message)
    process.exitCode = 1
  }
}

console.log('paint calculator')

const base = {
  units: 'metric',
  roomLength: 4.2,
  roomWidth: 3.6,
  wallHeight: 2.9,
  coats: 2,
  includeCeiling: false,
  trimAllowancePct: 8,
  coveragePerUnit: 11,
  packSizes: [20, 10, 4, 1],
}

test('worked example: 4.2 x 3.6 x 2.9 room', () => {
  const result = calculate({
    ...base,
    openings: [
      { id: 'd', kind: 'door', width: 0.9, height: 2.1, count: 1 },
      { id: 'w', kind: 'window', width: 1.2, height: 1.2, count: 2 },
    ],
  })
  assert.equal(result.wallArea, 45.24, 'wall area')
  assert.equal(result.openingsArea, 4.77, 'openings')
  assert.equal(result.paintableArea, 43.71, 'paintable area incl. trim')
  assert.equal(result.amountPerCoat, 3.97, 'litres per coat')
  assert.equal(result.amountWithAllowance, 8.34, 'litres incl. handling')
  assert.equal(result.amountBought, 9, 'litres bought')
  assert.deepEqual(result.packs, [
    { size: 4, count: 2, amount: 8 },
    { size: 1, count: 1, amount: 1 },
  ])
})

test('ceiling adds length x width', () => {
  const withCeiling = calculate({ ...base, openings: [], includeCeiling: true })
  const withoutCeiling = calculate({ ...base, openings: [], includeCeiling: false })
  assert.equal(Math.round((withCeiling.wallArea - withoutCeiling.wallArea) * 100) / 100, 0)
  assert.equal(withCeiling.ceilingArea, 15.12)
  assert.ok(withCeiling.paintableArea > withoutCeiling.paintableArea)
})

test('direct wall area bypasses the perimeter calculation', () => {
  const result = calculate({ ...base, totalWallArea: 100, openings: [] })
  assert.equal(result.wallArea, 100)
  assert.equal(result.paintableArea, 108)
})

test('imperial input is converted, not treated as metres', () => {
  const result = calculate({
    ...base,
    units: 'imperial',
    roomLength: 14,
    roomWidth: 12,
    wallHeight: 9,
    openings: [],
  })
  // 14 ft x 0.3048 = 4.2672 m, 12 ft = 3.6576 m, 9 ft = 2.7432 m
  assert.equal(result.wallArea, Math.round(2 * (4.2672 + 3.6576) * 2.7432 * 100) / 100)
  assert.equal(toMetres(10, 'imperial'), 3.048)
  assert.equal(toSquareMetres(1, 'imperial'), 0.09290304)
})

test('opening area respects count', () => {
  assert.equal(Math.round(openingArea({ id: 'x', kind: 'window', width: 1.2, height: 1.2, count: 3 }, 'metric') * 100) / 100, 4.32)
})

test('openings cannot push paintable area below zero', () => {
  const result = calculate({
    ...base,
    openings: [{ id: 'huge', kind: 'other', width: 50, height: 50, count: 1 }],
  })
  assert.equal(result.paintableArea, 0)
  assert.equal(result.amountTotal, 0)
  assert.deepEqual(result.packs, [])
})

test('one coat costs about half of two', () => {
  const one = calculate({ ...base, openings: [], coats: 1 })
  const two = calculate({ ...base, openings: [], coats: 2 })
  assert.ok(Math.abs(two.amountTotal - one.amountTotal * 2) < 0.02)
})

test('coat count is clamped to at least one', () => {
  const result = calculate({ ...base, openings: [], coats: 0 })
  assert.ok(result.amountTotal > 0)
})

test('coverage of zero falls back to a safe default instead of dividing by zero', () => {
  const result = calculate({ ...base, openings: [], coveragePerUnit: 0 })
  assert.ok(Number.isFinite(result.amountPerCoat))
  assert.ok(result.amountPerCoat > 0)
})

test('packs are only offered in real sizes and never fall short', () => {
  const { packs, amountBought } = choosePacks(8.34, [20, 10, 4, 1])
  assert.ok(amountBought >= 8.34)
  packs.forEach((pack) => assert.ok([20, 10, 4, 1].includes(pack.size)))
})

test('small pack is topped up when it does not quite reach', () => {
  const { packs, amountBought } = choosePacks(4.1, [20, 10, 4, 1])
  assert.ok(amountBought >= 4.1)
  assert.ok(packs.some((p) => p.size === 1))
})

test('a very large job uses the largest packs available', () => {
  const { packs } = choosePacks(210, [20, 10, 4, 1])
  const twenty = packs.find((p) => p.size === 20)
  assert.equal(twenty?.count, 10)
})

test('kg-based products report their own unit', () => {
  const result = calculate({
    ...base,
    openings: [],
    coveragePerUnit: 1.6,
    packSizes: [25, 10],
    unit: 'kg',
  })
  assert.equal(result.unit, 'kg')
  assert.ok(result.formula.some((line) => line.includes('kg')))
})

test('formula lines are human readable and include the coverage step', () => {
  const result = calculate({ ...base, openings: [] })
  assert.ok(result.formula.length >= 6)
  assert.ok(result.formula.some((line) => line.includes('÷')))
})

console.log(`\n${passed} passed${process.exitCode ? ' — with failures' : ''}`)
