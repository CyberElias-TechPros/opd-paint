import { hexToRgb } from './color'

/**
 * Preview compositing.
 *
 * The recolouring uses the canvas `color` blend mode: hue and saturation come
 * from the chosen paint, luminance comes from the photograph. That single line
 * is what makes the preview believable — highlights stay highlights, shadows
 * stay shadows, and the window light does not become a flat block of pigment.
 *
 * Two small extra passes finish it:
 *   • a low-alpha `multiply` of the same pigment, so the colour reaches into
 *     the darker half of the wall instead of only tinting the lit half;
 *   • for Silk, a low-alpha `soft-light` sheen gradient from the top-left, which
 *     is where the light usually falls in an interior photograph.
 *
 * This is a simulation and the interface says so. It cannot model the spectral
 * reflectance of a real film.
 */

export type FinishLook = 'matt' | 'silk'

export type FrameInput = {
  ctx: CanvasRenderingContext2D
  source: HTMLCanvasElement
  mask: HTMLCanvasElement
  hex: string
  finish: FinishLook
}

export function composeFrame({ ctx, source, mask, hex, finish }: FrameInput) {
  const w = source.width
  const h = source.height

  const tint = document.createElement('canvas')
  tint.width = w
  tint.height = h
  const tintCtx = tint.getContext('2d') as CanvasRenderingContext2D

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(source, 0, 0)

  // 1. pigment restricted to the mask
  tintCtx.clearRect(0, 0, w, h)
  tintCtx.fillStyle = hex
  tintCtx.fillRect(0, 0, w, h)
  tintCtx.globalCompositeOperation = 'destination-in'
  tintCtx.drawImage(mask, 0, 0)
  tintCtx.globalCompositeOperation = 'source-over'

  // 2. recolour, preserving photographic luminance
  ctx.globalCompositeOperation = 'color'
  ctx.drawImage(tint, 0, 0)

  // 3. reach into the shadows a little
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = 0.14
  ctx.drawImage(tint, 0, 0)

  // 4. finish character
  if (finish === 'silk') {
    const sheen = document.createElement('canvas')
    sheen.width = w
    sheen.height = h
    const sheenCtx = sheen.getContext('2d') as CanvasRenderingContext2D
    const gradient = sheenCtx.createLinearGradient(0, 0, w * 0.9, h)
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)')
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.08)')
    gradient.addColorStop(1, 'rgba(0,0,0,0.12)')
    sheenCtx.fillStyle = gradient
    sheenCtx.fillRect(0, 0, w, h)
    sheenCtx.globalCompositeOperation = 'destination-in'
    sheenCtx.drawImage(mask, 0, 0)

    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.5
    ctx.drawImage(sheen, 0, 0)
  } else {
    // matt: knock the very top of the highlight range back slightly
    ctx.globalCompositeOperation = 'source-atop'
    ctx.globalAlpha = 0.05
    ctx.fillStyle = hexToRgb(hex).r + hexToRgb(hex).g + hexToRgb(hex).b > 600 ? '#000000' : '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
