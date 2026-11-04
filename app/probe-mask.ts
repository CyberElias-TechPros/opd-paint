import { floodFill, maskCoverage, strokeBrush } from './src/lib/mask'

const imageData = (width: number, height: number, pixels: number[]) => ({
  width,
  height,
  data: new Uint8ClampedArray(pixels),
})

/* A 6x4 image: a light "wall" block on the left, a dark "door" on the right,
   with one near-wall pixel to exercise the tolerance. RGB only; alpha 255. */
const W = 6
const H = 4
const px: number[] = []
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const isDoor = x >= 4
    const near = x === 3 && y === 1
    const [r, g, b] = isDoor ? [40, 30, 25] : near ? [226, 220, 205] : [232, 226, 210]
    px.push(r, g, b, 255)
  }
}

const blankMask = () => new Uint8ClampedArray(W * H * 4)

const run = (tolerance: number, seed: [number, number], mode: 'add' | 'erase', initial?: Uint8ClampedArray) => {
  const source = imageData(W, H, px)
  const maskData = initial ?? blankMask()
  const mask = { width: W, height: H, data: maskData } as unknown as ImageData
  const result = floodFill(source, mask, seed[0], seed[1], tolerance, mode)
  const alphas: number[] = []
  for (let i = 3; i < maskData.length; i += 4) alphas.push(maskData[i])
  return { tolerance, seed, mode, ...result, alphas }
}

const filled = run(12, [0, 0], 'add')
const filledMask = new Uint8ClampedArray(W * H * 4)
for (let i = 0; i < filled.alphas.length; i += 1) filledMask[i * 4 + 3] = filled.alphas[i]

const stamps: { x: number; y: number }[] = []
const fakeCtx = {
  createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => {
    stamps.push({ x: x0, y: y0 })
    return { addColorStop: () => undefined }
  },
  save: () => undefined,
  restore: () => undefined,
  beginPath: () => undefined,
  arc: () => undefined,
  fill: () => undefined,
  globalCompositeOperation: 'source-over',
  fillStyle: null,
} as unknown as CanvasRenderingContext2D

strokeBrush(fakeCtx, { x: 10, y: 20 }, { x: 40, y: 20 }, 12, 'add')
const straight = stamps.splice(0, stamps.length)
strokeBrush(fakeCtx, { x: 5, y: 5 }, { x: 5, y: 5 }, 8, 'add')
const single = stamps.splice(0, stamps.length)

const coverage = maskCoverage(
  { getImageData: () => ({ data: filledMask }) } as unknown as CanvasRenderingContext2D,
  W,
  H,
)

console.log(
  JSON.stringify(
    {
      fills: [
        filled,
        run(0, [0, 0], 'add'),
        run(40, [0, 0], 'add'),
        run(12, [5, 3], 'add'),
        run(12, [-4, 99], 'add'),
        run(12, [0, 0], 'erase', filledMask),
      ],
      strokes: { straight, single },
      coverage,
      dimensions: [[4000, 3000], [1400, 1400], [800, 600], [1, 5000], [3000, 4000]].map(([w, h]) => {
        const scale = Math.min(1, 1400 / Math.max(w, h))
        return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))]
      }),
    },
    null,
    1,
  ),
)
