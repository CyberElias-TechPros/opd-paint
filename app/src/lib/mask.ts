/**
 * Client-side wall masking.
 *
 * Everything in this file runs in the browser. A visitor's photograph is never
 * uploaded, never stored on a server and never leaves the device — which is the
 * only privacy position that is both honest and cheap to guarantee. The
 * trade-off is that the segmentation is deliberately simple: a tolerance-based
 * flood fill plus a brush, rather than a machine-learning model. That is a
 * design decision, not a shortcut: the visitor stays in control, failures are
 * obvious and instantly correctable, and there is no upload, processing queue,
 * retention window or inference cost.
 *
 * Coordinate convention: all functions work in the pixel space of the working
 * canvas (see `prepareCanvas`), which the caller maps from pointer events.
 */

export const MAX_EDGE = 1400

/**
 * How long a photograph may take to decode before the preview gives up.
 *
 * Roadmap 12.02.12 asks for progress, timeout and failure states. Without a
 * deadline a decode that never settles — a truncated download, a phone asleep
 * mid-read, a browser that fires neither `load` nor `error` — leaves the visitor
 * staring at "Preparing…" with nothing to do about it. Twenty seconds is far
 * longer than any supported file needs and shorter than patience.
 */
export const LOAD_TIMEOUT_MS = 20_000

export type MaskMode = 'add' | 'erase'

/**
 * Reject `promise` after `ms` with `message`.
 *
 * Exported, and tested on its own, because the case it exists for is the one a
 * test can otherwise never reach: an image that neither loads nor fails.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => reject(new Error(message)), ms)
    // Node keeps the process alive for a pending timer. A deadline that may
    // never arrive must not be the reason a test run does not finish; browsers
    // have no `unref`, so the call is guarded rather than assumed.
    const unref = (handle as unknown as { unref?: () => void }).unref
    if (typeof unref === 'function') unref.call(handle)
    promise.then(
      (value) => {
        clearTimeout(handle)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(handle)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

export function loadImage(src: string, timeoutMs = LOAD_TIMEOUT_MS): Promise<HTMLImageElement> {
  return withTimeout(
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('That photograph could not be opened. It may be damaged, or still uploading.'))
      img.src = src
    }),
    timeoutMs,
    'That photograph took too long to open. Try a smaller version — phone resolution is plenty for this preview.',
  )
}

/** Draw an image into a canvas scaled so its longest edge is at most MAX_EDGE. */
export function prepareCanvas(img: HTMLImageElement, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.drawImage(img, 0, 0, width, height)
  return { canvas, ctx, width, height }
}

export function createMaskCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  return { canvas, ctx }
}

/**
 * Connected flood fill with a colour tolerance.
 *
 * A scanline fill is used rather than per-pixel recursion: it is iterative (so
 * a 1400px wall cannot blow the call stack), it is roughly an order of
 * magnitude faster on flat plaster, and its memory use is a single Uint8Array.
 */
export function floodFill(
  source: ImageData,
  mask: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number,
  mode: MaskMode,
): { changed: boolean; pixels: number } {
  const { width: w, height: h, data: src } = source
  const maskData = mask.data
  const x0 = Math.max(0, Math.min(w - 1, Math.round(seedX)))
  const y0 = Math.max(0, Math.min(h - 1, Math.round(seedY)))
  const seedIndex = (y0 * w + x0) * 4
  const sr = src[seedIndex]
  const sg = src[seedIndex + 1]
  const sb = src[seedIndex + 2]

  // 0..100 → 0..~260 euclidean RGB distance. 100 is intentionally generous.
  const maxDist = (tolerance / 100) * 260
  const maxDistSq = maxDist * maxDist

  const target = mode === 'add' ? 255 : 0
  const visited = new Uint8Array(w * h)
  const stack: number[] = [y0 * w + x0]
  let painted = 0

  const matches = (index: number) => {
    const p = index * 4
    const dr = src[p] - sr
    const dg = src[p + 1] - sg
    const db = src[p + 2] - sb
    return dr * dr + dg * dg + db * db <= maxDistSq
  }

  while (stack.length) {
    const index = stack.pop() as number
    if (visited[index]) continue
    const y = (index / w) | 0
    let left = index
    let right = index

    while (left % w > 0 && !visited[left - 1] && matches(left - 1)) left -= 1
    while (right % w < w - 1 && !visited[right + 1] && matches(right + 1)) right += 1

    for (let i = left; i <= right; i += 1) {
      if (visited[i]) continue
      if (!matches(i)) continue
      visited[i] = 1
      const p = i * 4
      if (maskData[p + 3] !== target) {
        maskData[p] = 255
        maskData[p + 1] = 255
        maskData[p + 2] = 255
        maskData[p + 3] = target
        painted += 1
      }
      if (y > 0) {
        const up = i - w
        if (!visited[up] && matches(up)) stack.push(up)
      }
      if (y < h - 1) {
        const down = i + w
        if (!visited[down] && matches(down)) stack.push(down)
      }
    }
  }

  return { changed: painted > 0, pixels: painted }
}

/** Soft-edged brush stamp, drawn directly onto the mask canvas. */
export function stampBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  mode: MaskMode,
  hardness = 0.55,
) {
  const gradient = ctx.createRadialGradient(x, y, radius * hardness, x, y, radius)
  // In `erase` mode the composite operation does the work and only the gradient's
  // alpha matters, so both branches can be opaque at the centre.
  const colour = mode === 'add' ? '255,255,255' : '0,0,0'
  gradient.addColorStop(0, `rgba(${colour},1)`)
  gradient.addColorStop(1, `rgba(${colour},0)`)
  ctx.save()
  ctx.globalCompositeOperation = mode === 'add' ? 'source-over' : 'destination-out'
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Interpolate between two pointer positions so fast drags leave no gaps. */
export function strokeBrush(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  mode: MaskMode,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  const step = Math.max(1, radius * 0.35)
  const steps = Math.max(1, Math.ceil(distance / step))
  for (let i = 0; i <= steps; i += 1) {
    stampBrush(ctx, from.x + (dx * i) / steps, from.y + (dy * i) / steps, radius, mode)
  }
}

/** Share of the image that has been masked — used for the progress read-out. */
export function maskCoverage(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const data = ctx.getImageData(0, 0, width, height).data
  let covered = 0
  let total = 0
  for (let i = 3; i < data.length; i += 4 * 8) {
    total += 1
    if (data[i] > 8) covered += 1
  }
  return total ? covered / total : 0
}

export function clearMask(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
}

export function cloneMask(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  copy.getContext('2d')?.drawImage(source, 0, 0)
  return copy
}
