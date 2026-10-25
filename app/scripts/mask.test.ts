/**
 * Flood-fill tests — run with `npm test`.
 *
 * The wall picker is the one piece of the visualiser that can fail quietly: a
 * fill that leaks through a doorframe or stops halfway up a wall still looks
 * like a working tool. These tests drive the algorithm with synthetic images so
 * the leak is caught here rather than by a customer.
 *
 * Node has no canvas, so the tests build the two objects `floodFill` actually
 * touches — `{ data, width, height }` — rather than mocking a whole 2D context.
 */
import assert from 'node:assert/strict'
import { floodFill } from '../src/lib/mask.ts'

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

type Pixels = { data: Uint8ClampedArray; width: number; height: number }

const blank = (width: number, height: number, rgba: [number, number, number, number] = [0, 0, 0, 0]): Pixels => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0]
    data[i + 1] = rgba[1]
    data[i + 2] = rgba[2]
    data[i + 3] = rgba[3]
  }
  return { data, width, height }
}

const solid = (width: number, height: number, rgb: [number, number, number]): Pixels => blank(width, height, [...rgb, 255])

const filledPixels = (mask: Pixels) => {
  let count = 0
  for (let i = 3; i < mask.data.length; i += 4) if (mask.data[i] > 0) count += 1
  return count
}

const paint = (image: Pixels, x: number, y: number, rgb: [number, number, number]) => {
  const p = (y * image.width + x) * 4
  image.data[p] = rgb[0]
  image.data[p + 1] = rgb[1]
  image.data[p + 2] = rgb[2]
  image.data[p + 3] = 255
}

console.log('wall-picker flood fill')

test('fills a flat region completely', () => {
  const source = solid(20, 20, [200, 200, 200])
  const mask = blank(20, 20)
  const result = floodFill(source, mask, 10, 10, 30, 'add')
  assert.equal(result.changed, true)
  assert.equal(filledPixels(mask), 400)
})

test('a one-pixel image is handled without edge errors', () => {
  const source = solid(1, 1, [10, 10, 10])
  const mask = blank(1, 1)
  const result = floodFill(source, mask, 0, 0, 10, 'add')
  assert.equal(result.changed, true)
  assert.equal(filledPixels(mask), 1)
})

test('seeds outside the canvas are clamped, not fatal', () => {
  const source = solid(8, 8, [120, 120, 120])
  const mask = blank(8, 8)
  const result = floodFill(source, mask, -40, 900, 30, 'add')
  assert.equal(result.changed, true)
  assert.equal(filledPixels(mask), 64)
})

test('a hard edge stops the fill', () => {
  // Left half light, right half dark: a low tolerance must not cross the seam.
  const source = solid(40, 20, [220, 220, 220])
  for (let y = 0; y < 20; y += 1) for (let x = 20; x < 40; x += 1) paint(source, x, y, [20, 20, 20])
  const mask = blank(40, 20)
  floodFill(source, mask, 5, 5, 20, 'add')
  assert.equal(filledPixels(mask), 20 * 20, 'fill leaked across the edge')
})

test('a generous tolerance follows a gradient further than a tight one', () => {
  // A vertical gradient, 1 luminance step per row.
  const source = blank(30, 60)
  for (let y = 0; y < 60; y += 1) {
    for (let x = 0; x < 30; x += 1) paint(source, x, y, [100 + y, 100 + y, 100 + y])
  }

  const tight = blank(30, 60)
  floodFill(source, tight, 15, 0, 5, 'add')
  const generous = blank(30, 60)
  floodFill(source, generous, 15, 0, 60, 'add')

  assert.ok(filledPixels(generous) > filledPixels(tight), 'tolerance has no effect')
  assert.ok(filledPixels(tight) >= 30, 'tight tolerance selected nothing')
})

test('erase mode clears a selection instead of adding to it', () => {
  const source = solid(16, 16, [90, 90, 90])
  const mask = blank(16, 16)
  floodFill(source, mask, 1, 1, 30, 'add')
  assert.equal(filledPixels(mask), 256)

  const erased = floodFill(source, mask, 8, 8, 30, 'erase')
  assert.equal(erased.changed, true)
  assert.equal(filledPixels(mask), 0)
})

test('re-filling an already selected area reports no change', () => {
  const source = solid(12, 12, [70, 70, 70])
  const mask = blank(12, 12)
  floodFill(source, mask, 6, 6, 30, 'add')
  const again = floodFill(source, mask, 6, 6, 30, 'add')
  assert.equal(again.changed, false)
  assert.equal(again.pixels, 0)
})

test('a full-size frame fills without exhausting the stack', () => {
  // 1400 px is MAX_EDGE; recursion here would throw RangeError.
  const size = 1400
  const source = solid(size, size, [180, 180, 180])
  const mask = blank(size, size)
  const started = Date.now()
  const result = floodFill(source, mask, size / 2, size / 2, 25, 'add')
  const elapsed = Date.now() - started

  assert.equal(result.changed, true)
  assert.equal(filledPixels(mask), size * size)
  assert.ok(elapsed < 8000, `fill took ${elapsed}ms`)
})

test('diagonal neighbours are not connected (4-way fill)', () => {
  const source = blank(40, 40)
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      paint(source, x, y, (x + y) % 2 === 0 ? [240, 240, 240] : [10, 10, 10])
    }
  }
  const mask = blank(40, 40)
  floodFill(source, mask, 0, 0, 10, 'add')
  // A checkerboard's same-colour cells only touch at their corners, and the
  // fill is deliberately 4-way: it must not jump a diagonal.
  assert.equal(filledPixels(mask), 1, 'fill jumped to a diagonal neighbour')
})

console.log(`\n${passed} passed${process.exitCode ? ' — with failures' : ''}`)
