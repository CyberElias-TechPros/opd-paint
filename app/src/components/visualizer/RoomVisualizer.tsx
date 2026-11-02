import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Brush,
  Download,
  Eraser,
  ImagePlus,
  Loader2,
  PaintBucket,
  RotateCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  Wand2,
} from 'lucide-react'
import { COLORS, FAMILIES, COLOR_LRV, type PaintColor } from '../../data/colors'
import { PALETTES } from '../../data/palettes'
import { getImage } from '../../lib/media'
import {
  clearMask,
  cloneMask,
  createMaskCanvas,
  floodFill,
  loadImage,
  maskCoverage,
  prepareCanvas,
  strokeBrush,
} from '../../lib/mask'
import { composeFrame, createScratch, type FinishLook, type Scratch } from '../../lib/render'
import { Button, ButtonLink } from '../ui/Button'
import { Pill } from '../ui/Bits'
import { useApp } from '../../store/AppStore'
import { track } from '../../lib/analytics'
import { cn } from '../../lib/cn'

const DEMO_ROOMS = [
  { id: 'interior-mauve-peach', label: 'Empty room', note: 'Port Harcourt apartment, before furnishing' },
  { id: 'interior-lilac-lounge', label: 'Finished lounge', note: 'GRA Phase 2, in lilac' },
  { id: 'project-cream-scaffold', label: 'Exterior wall', note: 'Site photograph, mid-paint' },
]

type Tool = 'fill' | 'brush' | 'erase'

/**
 * Where the compare divider starts: half the frame original, half painted.
 *
 * It used to start at 100 — which is the whole frame showing the *original*
 * photograph, so a visitor who selected a wall and picked a colour saw nothing
 * change until they dragged a slider towards the end labelled "Before".
 * Roadmap 12.02.09 asks for an original-versus-preview comparison; a comparison
 * that hides the preview by default is not one.
 */
const DEFAULT_SPLIT = 50

/** Travel, in CSS pixels, that still counts as a tap rather than a scroll. */
const TAP_SLOP_CSS_PX = 12

/** The formats the file input offers and the canvas can actually decode. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
/** A 1×1 photo or a corrupt header decodes to nothing paintable. */
const MIN_DIMENSION = 16

export function RoomVisualizer({ initialColour }: { initialColour?: PaintColor | undefined }) {
  const [colour, setColour] = useState<PaintColor>(initialColour ?? COLORS[0])
  const [finish, setFinish] = useState<FinishLook>('matt')
  const [roomId, setRoomId] = useState<string>(DEMO_ROOMS[0].id)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<string>('Loading the room…')
  const [error, setError] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('fill')
  const [tolerance, setTolerance] = useState(26)
  const [brushSize, setBrushSize] = useState(42)
  const [coverage, setCoverage] = useState(0)
  const [split, setSplit] = useState(DEFAULT_SPLIT)
  /** Roadmap 12.02.11 — a usable fallback where the canvas itself is missing. */
  const [supported, setSupported] = useState(true)
  const [dragging, setDragging] = useState(false)
  /** The keyboard cursor, mirrored into state so it can be drawn. */
  const [keyPoint, setKeyPoint] = useState<{ x: number; y: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<string>('All')
  const [uploadedName, setUploadedName] = useState<string | null>(null)

  const outputRef = useRef<HTMLCanvasElement | null>(null)
  const sourceRef = useRef<HTMLCanvasElement | null>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const maskCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sourceDataRef = useRef<ImageData | null>(null)
  const undoRef = useRef<HTMLCanvasElement[]>([])
  const paintingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  /** A touch that has gone down but not yet come up, so a scroll is not a fill. */
  const pendingFillRef = useRef<{ x: number; y: number } | null>(null)
  const scratchRef = useRef<Scratch | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const { toggleColor, isSaved, toast } = useApp()
  const objectUrlRef = useRef<string | null>(null)
  /** Keyboard cursor position, in source-canvas pixels. */
  const keyPointRef = useRef<{ x: number; y: number } | null>(null)


  const render = useCallback(() => {
    const ctx = outputRef.current?.getContext('2d')
    const source = sourceRef.current
    const mask = maskRef.current
    if (!ctx || !source || !mask) return
    // One pair of offscreen canvases for the lifetime of the image: a brush
    // stroke calls this for every pointer event, and allocating two frame-sized
    // canvases each time is what turns a drag into a stutter.
    scratchRef.current ??= createScratch()
    composeFrame({ ctx, source, mask, hex: colour.hex, finish, scratch: scratchRef.current })
  }, [colour.hex, finish])

  /**
   * Read the selection back out of the mask.
   *
   * Separate from `render` on purpose: it is a full-frame `getImageData`, so it
   * belongs at the end of a gesture, not inside every frame of one.
   */
  const measure = useCallback(() => {
    const mask = maskRef.current
    if (!mask || !maskCtxRef.current) return
    setCoverage(Math.round(maskCoverage(maskCtxRef.current, mask.width, mask.height) * 100))
  }, [])

  /* --------------------------------------------------------- load an image */
  const loadSource = useCallback(
    async (src: string, label: string) => {
      setError(null)
      setBusy(true)
      setReady(false)
      setStatus('Loading the room…')
      track('visualizer_start', { source: label.startsWith('Your photo') ? 'upload' : 'demo' })
      try {
        const img = await loadImage(src)
        if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth < MIN_DIMENSION || img.naturalHeight < MIN_DIMENSION) {
          throw new Error('That image has no readable dimensions. It may be damaged, or not a photograph at all.')
        }
        const { canvas, ctx, width, height } = prepareCanvas(img)

        sourceRef.current = canvas
        sourceDataRef.current = ctx.getImageData(0, 0, width, height)

        const { canvas: maskCanvas, ctx: maskCtx } = createMaskCanvas(width, height)
        maskRef.current = maskCanvas
        maskCtxRef.current = maskCtx
        undoRef.current = []
        setCanUndo(false)
        setSplit(DEFAULT_SPLIT)
        keyPointRef.current = null
        setKeyPoint(null)
        scratchRef.current = null
        setStatus('Tap or click the wall you want to paint.')
        setUploadedName(label.startsWith('Your photo') ? label : null)

        const output = outputRef.current
        if (output) {
          output.width = width
          output.height = height
        }
        setReady(true)
        setCoverage(0)
        render()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'That image could not be opened.'
        // `prepareCanvas` only throws when the browser has no 2D context to give.
        // That is not a broken photograph, it is an unsupported device, and the
        // honest response is the fallback rather than an error the visitor can
        // do nothing about.
        if (/canvas is not available/i.test(message)) {
          setSupported(false)
          setStatus('This browser cannot run the preview.')
          return
        }
        setError(message)
        setStatus('Image could not be loaded.')
      } finally {
        setBusy(false)
      }
    },
    [render],
  )

  useEffect(() => {
    const room = DEMO_ROOMS.find((r) => r.id === roomId)
    if (!room) return
    void loadSource(getImage(room.id).src, room.label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  useEffect(() => {
    if (ready) render()
  }, [ready, render])

  /**
   * Probe for a canvas the browser can actually draw on.
   *
   * Roadmap 12.02.11 wants a usable fallback on unsupported devices. Doing it
   * here rather than in the catch means the visitor is told at once, instead of
   * after an image has been fetched into a page that cannot paint it.
   */
  useEffect(() => {
    try {
      if (!document.createElement('canvas').getContext('2d')) setSupported(false)
    } catch {
      setSupported(false)
    }
  }, [])

  /**
   * Follow the colour the visitor arrived with.
   *
   * `?colour=` is read once by `useState`, so a link clicked from the project
   * board while this page was already open — the same route, a new search string
   * — used to be ignored. The identity is the library object itself, so this
   * only fires when the colour genuinely changes.
   */
  useEffect(() => {
    if (initialColour) setColour(initialColour)
  }, [initialColour])

  // A photograph is held as an object URL for as long as it is on screen. It is
  // revoked on the next upload and here, on the way out — roadmap 12.02.13 in the
  // only form that applies when nothing is ever uploaded.
  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    },
    [],
  )

  /* ------------------------------------------------------------- undo stack */
  const pushUndo = () => {
    const mask = maskRef.current
    if (!mask) return
    undoRef.current = [...undoRef.current.slice(-9), cloneMask(mask)]
    setCanUndo(true)
  }

  const undo = () => {
    const previous = undoRef.current.pop()
    if (!previous || !maskCtxRef.current) return
    const ctx = maskCtxRef.current
    ctx.clearRect(0, 0, previous.width, previous.height)
    ctx.drawImage(previous, 0, 0)
    setCanUndo(undoRef.current.length > 0)
    render()
    measure()
    setStatus('Undone.')
  }

  const resetMask = () => {
    const mask = maskRef.current
    const ctx = maskCtxRef.current
    if (!mask || !ctx) return
    pushUndo()
    clearMask(ctx, mask.width, mask.height)
    render()
    measure()
    setStatus('Selection cleared. Choose a wall again.')
  }

  /* ----------------------------------------------------------- wall picker */
  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = outputRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return { x: 0, y: 0 }
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  /** Canvas pixels per CSS pixel, so a tap slop means the same thing zoomed in. */
  const canvasScale = () => {
    const canvas = outputRef.current
    if (!canvas) return 1
    const rect = canvas.getBoundingClientRect()
    return rect.width ? canvas.width / rect.width : 1
  }

  const applyFill = (x: number, y: number) => {
    const maskCtx = maskCtxRef.current
    const mask = maskRef.current
    const sourceData = sourceDataRef.current
    if (!maskCtx || !mask || !sourceData) return
    pushUndo()
    const maskImage = maskCtx.getImageData(0, 0, mask.width, mask.height)
    const { changed } = floodFill(sourceData, maskImage, x, y, tolerance, 'add')
    maskCtx.putImageData(maskImage, 0, 0)
    render()
    measure()
    setStatus(
      changed
        ? 'Wall selected. Adjust tolerance to catch more or less of it.'
        : 'Nothing to select there — try a slightly higher tolerance, or use the brush.',
    )
    if (changed) track('visualizer_apply', { tool: 'fill', tolerance })
  }

  /**
   * Apply whatever tool is selected, at one point.
   *
   * The keyboard route used to flood-fill no matter which tool was chosen, so a
   * visitor who had switched to the brush and set a size got a different tool
   * from the one on screen. Enter now does what the pointer does.
   */
  const applyAtPoint = (x: number, y: number) => {
    if (tool === 'fill') {
      applyFill(x, y)
      return
    }
    const maskCtx = maskCtxRef.current
    if (!maskCtx) return
    pushUndo()
    const point = { x, y }
    strokeBrush(maskCtx, point, point, brushSize / 2, tool === 'erase' ? 'erase' : 'add')
    render()
    measure()
    setStatus(tool === 'erase' ? 'Erased at the cursor.' : 'Brushed at the cursor.')
    track('visualizer_apply', { tool, size: brushSize, input: 'keyboard' })
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready || !supported) return
    const point = toCanvasPoint(event)
    if (tool === 'fill') {
      // A finger that lands on the picture is more often the start of a scroll
      // than a request to paint — and the canvas is the first thing on the page
      // on a phone, so swallowing the scroll traps the visitor at the top. Fill
      // on release instead, and only if the finger stayed put. Mouse and pen are
      // unambiguous, so they still fill at once.
      if (event.pointerType === 'touch') {
        pendingFillRef.current = point
        return
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      applyFill(point.x, point.y)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    pushUndo()
    paintingRef.current = true
    lastPointRef.current = point
    const maskCtx = maskCtxRef.current
    if (!maskCtx) return
    strokeBrush(maskCtx, point, point, brushSize / 2, tool === 'erase' ? 'erase' : 'add')
    render()
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current || tool === 'fill') return
    const point = toCanvasPoint(event)
    const maskCtx = maskCtxRef.current
    if (!maskCtx) return
    strokeBrush(maskCtx, lastPointRef.current ?? point, point, brushSize / 2, tool === 'erase' ? 'erase' : 'add')
    lastPointRef.current = point
    render()
  }

  /**
   * Keyboard route into the canvas.
   *
   * A pointer-only tool excludes anyone using a keyboard or a switch device.
   * Arrow keys move a cursor over the picture, Enter applies the current tool at
   * that point, and every move is announced through the live status line so the
   * position is never only visual.
   */
  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const mask = maskRef.current
    if (!mask || !ready) return
    const step = event.shiftKey ? 0.08 : 0.02
    const current = keyPointRef.current ?? { x: mask.width / 2, y: mask.height * 0.45 }
    let { x, y } = current

    switch (event.key) {
      case 'ArrowLeft':
        x -= mask.width * step
        break
      case 'ArrowRight':
        x += mask.width * step
        break
      case 'ArrowUp':
        y -= mask.height * step
        break
      case 'ArrowDown':
        y += mask.height * step
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        applyAtPoint(x, y)
        return
      default:
        return
    }

    event.preventDefault()
    x = Math.max(0, Math.min(mask.width - 1, x))
    y = Math.max(0, Math.min(mask.height - 1, y))
    keyPointRef.current = { x, y }
    // Mirrored into state because a ref cannot draw the cursor: a keyboard-only
    // visitor gets the position announced *and* shown.
    setKeyPoint({ x, y })
    setStatus(
      `Cursor ${Math.round((x / mask.width) * 100)}% from the left, ${Math.round((y / mask.height) * 100)}% from the top. Press Enter to ${
        tool === 'fill' ? 'select' : tool === 'erase' ? 'erase' : 'brush'
      } here.`,
    )
  }

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const pending = pendingFillRef.current
    if (pending) {
      pendingFillRef.current = null
      const point = toCanvasPoint(event)
      const slop = TAP_SLOP_CSS_PX * canvasScale()
      if (Math.hypot(point.x - pending.x, point.y - pending.y) <= slop) {
        applyFill(point.x, point.y)
      } else {
        setStatus('That was a scroll, not a tap, so nothing was painted. Tap the wall once to select it.')
      }
      return
    }
    if (paintingRef.current) {
      paintingRef.current = false
      lastPointRef.current = null
      measure()
      setStatus('Selection updated.')
      track('visualizer_apply', { tool, size: brushSize })
    }
  }

  /** The gesture was taken away — cancelled, or dragged off the picture. */
  const cancelStroke = () => {
    pendingFillRef.current = null
    if (paintingRef.current) {
      paintingRef.current = false
      lastPointRef.current = null
      measure()
      setStatus('Selection updated.')
    }
  }

  /* --------------------------------------------------------------- upload */
  const onUpload = useCallback(async (file: File) => {
    // Roadmap 12.02.02: type, size and dimensions are all validated, and the
    // accepted list here is the same list the file input offers. Accepting any
    // `image/*` while advertising three formats is how a visitor gets a canvas
    // error instead of a sentence they can act on.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a JPG, PNG or WebP image — that is what the preview can read.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That photo is larger than 12 MB. Try a smaller version — the preview works well at phone resolution.')
      return
    }
    if (file.size === 0) {
      setError('That file is empty. Choose the photograph again.')
      return
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    await loadSource(url, `Your photo — ${file.name.slice(0, 40)}`)
  }, [loadSource])

  /**
   * Drop and paste go through exactly the same validation as the file input.
   *
   * A tool that asks for a photograph is a tool people drag one onto; making them
   * find the input first is the difference between a feature and a form. The
   * accepted list, the size limit and the decode errors are shared, so there is
   * one set of rules however the picture arrives.
   */
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) void onUpload(file)
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        event.preventDefault()
        void onUpload(file)
        return
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onUpload])

  const download = () => {
    const canvas = outputRef.current
    if (!canvas) return
    setStatus('Encoding your preview…')
    try {
      // `toBlob` rather than `toDataURL`: a 1400px frame is a base64 string of
      // several megabytes held in memory twice, and iOS Safari drops data-URL
      // downloads of that size without saying so. The blob is revoked once the
      // browser has taken the click.
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('This browser could not encode the preview. A screenshot will capture exactly what you see.')
          setStatus('Preview could not be saved.')
          return
        }
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `opudas-preview-${colour.id}-${finish}.png`
        link.href = url
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        setStatus('Preview saved to your downloads.')
        track('visualizer_export', { colourId: colour.id, finish })
        toast('Preview saved', { description: 'A simulation only — confirm the colour with a sample pot.' })
      }, 'image/png')
    } catch {
      setError('The browser blocked the download. You can still screenshot the preview.')
    }
  }

  const filteredColours = useMemo(() => {
    const q = query.trim().toLowerCase()
    return COLORS.filter((c) => {
      const matchesFamily = family === 'All' || c.family === family
      const matchesQuery = !q || `${c.name} ${c.code} ${c.family} ${c.undertone}`.toLowerCase().includes(q)
      return matchesFamily && matchesQuery
    })
  }, [query, family])

  const saved = isSaved(colour.id)

  if (!supported) {
    // Roadmap 12.02.11. A browser with no 2D canvas cannot run this tool at
    // all, and the alternative to a real fallback is a grey rectangle with a
    // spinner that never stops — which is what the page used to do.
    return (
      <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-6 sm:p-8">
        <p className="flex items-center gap-2 text-[0.78rem] font-bold uppercase tracking-[0.14em] text-ink/72">
          <TriangleAlert className="size-4 text-green-deep" aria-hidden /> Preview unavailable here
        </p>
        <h2 className="mt-3 font-[var(--font-display)] text-[clamp(1.5rem,3vw,2rem)]">
          This browser cannot paint the photograph.
        </h2>
        <p className="mt-3 max-w-xl text-[0.9rem] leading-relaxed text-ink/72">
          The room preview draws your wall on a canvas, and this browser has no canvas to draw on — usually an old
          version, or a locked-down one. Nothing is wrong with your photograph. The rest of the site works normally, and
          every colour is available as a printed document or a physical sample.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink to="/colours">Browse the {COLORS.length} colours</ButtonLink>
          <ButtonLink to="/documents/opudas-colour-book.pdf" variant="paper" external>
            Download the colour book
          </ButtonLink>
          <ButtonLink to="/quote" variant="outline">
            Ask for physical samples
          </ButtonLink>
        </div>
        <p className="mt-4 text-[0.76rem] text-ink/72">
          On a phone? The preview runs in Safari 15+ and Chrome 90+.{' '}
          <Link to="/advice/colour-on-screen" className="underline hover:text-green">
            Why a screen is not a wall
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-10">
      {/* ------------------------------------------------------- canvas panel */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div
          className={cn(
            'relative overflow-hidden rounded-sm bg-ink shadow-[0_40px_90px_-50px_rgba(11,26,19,0.7)] transition-shadow',
            dragging && 'ring-2 ring-green-bright ring-offset-2 ring-offset-paper',
          )}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="relative">
            <canvas
              ref={outputRef}
              role="img"
              aria-label={`Room preview painted in ${colour.name}. Use the controls to select walls, then choose a colour.`}
              aria-describedby="visualizer-help"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={cancelStroke}
              onPointerLeave={cancelStroke}
              onKeyDown={onCanvasKeyDown}
              tabIndex={0}
              className={cn(
                'block w-full select-none',
                // With the fill tool the page still has to scroll past the
                // picture on a phone; the brush and eraser need the gesture.
                tool === 'fill' ? 'touch-pan-y' : 'touch-none',
                tool === 'fill' ? 'cursor-crosshair' : 'cursor-cell',
                !ready && 'opacity-40',
              )}
            />

            {/* the keyboard cursor — announced *and* drawn */}
            {ready && keyPoint && sourceRef.current ? (
              <span
                aria-hidden
                className="pointer-events-none absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-2 bg-paper-2/10 shadow-[0_0_0_2px_rgba(11,26,19,0.45)]"
                style={{
                  left: `${(keyPoint.x / sourceRef.current.width) * 100}%`,
                  top: `${(keyPoint.y / sourceRef.current.height) * 100}%`,
                }}
              />
            ) : null}

            {dragging ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/70 backdrop-blur-[2px]">
                <span className="flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2 text-[0.8rem] font-semibold">
                  <ImagePlus className="size-4" aria-hidden /> Drop the photograph here
                </span>
              </div>
            ) : null}

            {/* original image revealed from the left by the compare slider */}
            {ready && split > 0 ? (
              <canvas
                aria-hidden
                ref={(node) => {
                  const source = sourceRef.current
                  if (!node || !source) return
                  if (node.width !== source.width || node.height !== source.height) {
                    node.width = source.width
                    node.height = source.height
                  }
                  const ctx = node.getContext('2d')
                  if (!ctx) return
                  ctx.clearRect(0, 0, node.width, node.height)
                  ctx.drawImage(source, 0, 0)
                  node.style.clipPath = `inset(0 ${100 - split}% 0 0)`
                }}
                className="pointer-events-none absolute inset-0 size-full"
              />
            ) : null}

            {split > 0 && split < 100 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-paper-2/90 shadow-[0_0_18px_rgba(0,0,0,0.5)]"
                style={{ left: `${split}%` }}
              >
                <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink/70 px-2 py-0.5 text-[0.55rem] font-bold tracking-[0.1em] text-paper-2/90 backdrop-blur">
                  BEFORE
                </span>
                <span className="absolute left-2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-paper-2 text-ink shadow-lg">
                  <span className="text-[0.55rem] font-bold tracking-tight">AFTER</span>
                </span>
              </div>
            ) : null}

            {busy ? (
              <div className="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-[2px]">
                <span className="flex items-center gap-2 rounded-full bg-paper-2 px-4 py-2 text-[0.8rem] font-semibold">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Preparing…
                </span>
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
              <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 text-[0.63rem] font-bold uppercase tracking-[0.12em] text-paper-2/90 backdrop-blur">
                <ShieldCheck className="size-3" aria-hidden /> Stays on your device
              </span>
              <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-paper-2/90 px-2.5 py-1 text-[0.63rem] font-bold uppercase tracking-[0.12em] text-ink backdrop-blur">
                Simulation
              </span>
            </div>
          </div>

          {/* compare slider — a real range input so it is keyboard operable.
              The left of the frame is the original, the right is the paint, so
              the value says how much of the photograph is still showing. */}
          <div className="flex items-center gap-3 border-t border-paper-2/10 bg-ink px-4 py-3">
            <span className="kicker shrink-0 text-paper-2/65">Before</span>
            <input
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(event) => setSplit(Number(event.target.value))}
              aria-label="Move the divider between the original photograph and the painted preview"
              aria-valuetext={`${split}% of the frame shows the original photograph, ${100 - split}% shows it painted in ${colour.name}`}
              className="flex-1 [&::-webkit-slider-runnable-track]:bg-paper-2/25 [&::-moz-range-track]:bg-paper-2/25 [&::-webkit-slider-thumb]:border-ink"
            />
            <span className="kicker shrink-0 text-paper-2/65">After</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.76rem] text-ink/72">
            {uploadedName ? uploadedName : DEMO_ROOMS.find((r) => r.id === roomId)?.note}
            {ready ? ` · ${coverage}% of the frame selected` : null}
          </p>
          <div className="flex gap-2">
            <Button variant="paper" size="sm" onClick={download} disabled={!ready || coverage === 0}>
              <Download className="size-3.5" aria-hidden /> Save preview
            </Button>
          </div>
        </div>

        <p aria-live="polite" className="mt-2 min-h-5 text-[0.78rem] font-medium text-green">
          {status}
        </p>
        <p id="visualizer-help" className="mt-1 text-[0.74rem] leading-relaxed text-ink/72">
          With a mouse: click the wall to select it, or switch to the brush and drag. Drag a photograph onto the picture
          to use your own. With a keyboard: focus the picture, move the ring with the arrow keys — hold Shift for larger
          steps — and press Enter to select or erase at that point.
        </p>
        {error ? (
          <p role="alert" className="mt-2 rounded-sm border border-crimson/30 bg-crimson/5 px-3 py-2 text-[0.8rem] text-crimson">
            {error}
          </p>
        ) : null}
      </div>

      {/* ------------------------------------------------------- control rail */}
      <div className="space-y-6">
        {/* 01 room */}
        <section aria-labelledby="step-room" className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
          <div className="flex items-baseline justify-between">
            <h3 id="step-room" className="kicker text-ink/72">
              01 — Choose a room
            </h3>
            <span className="text-[0.68rem] text-ink/72">or upload your own</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMO_ROOMS.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setRoomId(room.id)}
                aria-pressed={roomId === room.id && !uploadedName}
                className={cn(
                  'overflow-hidden rounded-[3px] border text-left transition-all duration-300',
                  roomId === room.id && !uploadedName
                    ? 'border-ink ring-1 ring-ink'
                    : 'border-ink/12 opacity-80 hover:opacity-100',
                )}
              >
                <img
                  src={getImage(room.id).thumb}
                  alt=""
                  width={160}
                  height={100}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                <span className="block px-1.5 py-1 text-[0.66rem] font-semibold leading-tight">{room.label}</span>
              </button>
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 rounded-[3px] border border-dashed border-ink/25 px-3 py-2.5 text-[0.78rem] font-semibold transition-colors hover:border-green hover:text-green">
            <span className="flex items-center gap-2">
              <ImagePlus className="size-4" aria-hidden /> Upload a photo
            </span>
            <span className="text-[0.66rem] font-medium text-ink/72">JPG · PNG · WebP · ≤12 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onUpload(file)
                event.target.value = ''
              }}
            />
          </label>
          <p className="mt-1.5 text-[0.7rem] text-ink/72">
            Or drop a photograph onto the picture, or paste one from the clipboard.
          </p>
        </section>

        {/* 02 mask */}
        <section aria-labelledby="step-mask" className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
          <h3 id="step-mask" className="kicker text-ink/72">
            02 — Select the wall
          </h3>
          <div className="mt-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Selection tool">
            {[
              { id: 'fill' as Tool, label: 'Magic fill', icon: PaintBucket },
              { id: 'brush' as Tool, label: 'Brush', icon: Brush },
              { id: 'erase' as Tool, label: 'Erase', icon: Eraser },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTool(option.id)}
                aria-pressed={tool === option.id}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-[3px] border px-2 py-2.5 text-[0.7rem] font-semibold transition-colors',
                  tool === option.id
                    ? 'border-ink bg-ink text-paper-2'
                    : 'border-ink/15 text-ink/70 hover:border-ink/40',
                )}
              >
                <option.icon className="size-4" aria-hidden />
                {option.label}
              </button>
            ))}
          </div>

          {tool === 'fill' ? (
            <div className="mt-4">
              <label htmlFor="tolerance" className="flex items-center justify-between text-[0.74rem] font-semibold text-ink/70">
                Tolerance
                <span className="tabular text-ink/72">{tolerance}</span>
              </label>
              <input
                id="tolerance"
                type="range"
                min={4}
                max={70}
                value={tolerance}
                onChange={(event) => setTolerance(Number(event.target.value))}
                aria-describedby="tolerance-help"
              />
              <p id="tolerance-help" className="text-[0.72rem] text-ink/72">
                Higher values catch more of a shadowed or uneven wall; lower values keep the selection tight.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <label htmlFor="brush" className="flex items-center justify-between text-[0.74rem] font-semibold text-ink/70">
                Brush size
                <span className="tabular text-ink/72">{brushSize}px</span>
              </label>
              <input
                id="brush"
                type="range"
                min={8}
                max={140}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
              />
              <p className="text-[0.72rem] text-ink/72">Paint over the remaining bands, edges and reveals by hand.</p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button variant="paper" size="sm" onClick={undo} disabled={!canUndo}>
              <Undo2 className="size-3.5" aria-hidden /> Undo
            </Button>
            <Button variant="paper" size="sm" onClick={resetMask} disabled={!ready || coverage === 0}>
              <RotateCcw className="size-3.5" aria-hidden /> Clear selection
            </Button>
          </div>

          <div className="mt-3">
            <div className="h-1 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-green transition-[width] duration-300"
                style={{ width: `${Math.min(100, coverage)}%` }}
              />
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.7rem] text-ink/72">
              <Wand2 className="size-3" aria-hidden /> {coverage}% selected. A wall is usually 25–60% of the frame.
            </p>
          </div>
        </section>

        {/* 03 colour */}
        <section aria-labelledby="step-colour" className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 id="step-colour" className="kicker text-ink/72">
              03 — Choose a colour
            </h3>
            <span
              className="size-6 rounded-[3px] ring-1 ring-inset ring-black/15"
              style={{ background: colour.hex }}
              aria-hidden
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink/72" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search colour or code"
                aria-label="Search colours"
                className="field py-1.5 pl-8 text-[0.8rem]"
              />
            </div>
          </div>

          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
            <Pill active={family === 'All'} onClick={() => setFamily('All')}>
              All
            </Pill>
            {FAMILIES.map((f) => (
              <Pill key={f} active={family === f} onClick={() => setFamily(f)}>
                {f.replace(' & ', ' / ')}
              </Pill>
            ))}
          </div>

          <div className="mt-2 grid max-h-56 grid-cols-8 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-10">
            {filteredColours.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setColour(c)
                  track('colour_view', { colourId: c.id, surface: 'visualizer' })
                }}
                title={`${c.name} · ${c.code}`}
                aria-label={`Apply ${c.name}, code ${c.code}`}
                aria-pressed={colour.id === c.id}
                className={cn(
                  'group relative aspect-square rounded-[2px] ring-1 ring-inset ring-black/10 transition-transform duration-200 hover:scale-110',
                  colour.id === c.id && 'scale-110 ring-2 ring-ink',
                )}
                style={{ background: c.hex }}
              />
            ))}
          </div>

          <div className="mt-3 rounded-[3px] border border-ink/10 bg-white/50 p-3">
            <p className="text-[0.88rem] font-semibold">{colour.name}</p>
            <p className="text-[0.72rem] text-ink/72">
              {colour.code} · {colour.family} · LRV ≈ {COLOR_LRV(colour)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={saved ? 'paper' : 'solid'}
                onClick={() => toggleColor(colour.id)}
                aria-pressed={saved}
              >
                {saved ? 'Saved to project' : 'Save to project'}
              </Button>
              <Link
                to={`/colours/${colour.id}`}
                className="inline-flex items-center rounded-[3px] px-3 py-2 text-[0.78rem] font-bold uppercase tracking-[0.1em] text-green hover:bg-green/10"
              >
                Colour details
              </Link>
            </div>
          </div>

          <fieldset className="mt-3">
            <legend className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink/72">Finish</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(['matt', 'silk'] as FinishLook[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFinish(f)}
                  aria-pressed={finish === f}
                  className={cn(
                    'rounded-[3px] border px-2 py-2 text-[0.74rem] font-semibold capitalize transition-colors',
                    finish === f ? 'border-ink bg-ink text-paper-2' : 'border-ink/15 hover:border-ink/40',
                  )}
                >
                  {f} {f === 'matt' ? '· flat' : '· soft sheen'}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-3">
            <p className="kicker mb-1.5 text-ink/72">Or start from a palette</p>
            <div className="flex flex-wrap gap-1.5">
              {PALETTES.slice(0, 5).map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => {
                    const first = COLORS.find((c) => c.id === palette.colors[0])
                    if (first) setColour(first)
                    track('palette_view', { paletteId: palette.id, surface: 'visualizer' })
                  }}
                  className="group flex items-center gap-1 rounded-full border border-ink/15 py-1 pl-1 pr-2.5 text-[0.68rem] font-semibold transition-colors hover:border-ink/45"
                >
                  <span className="flex overflow-hidden rounded-full">
                    {palette.colors.slice(0, 4).map((id) => {
                      const c = COLORS.find((x) => x.id === id)
                      return c ? <span key={id} className="size-3.5" style={{ background: c.hex }} /> : null
                    })}
                  </span>
                  {palette.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <p className="text-[0.72rem] leading-relaxed text-ink/72">
          Your photograph is processed in this browser tab and is never uploaded, so there is nothing for us to store or
          delete — and the file you save is a new PNG carrying none of your camera's location or device metadata. The
          preview is a simulation: it preserves the light and shadow in your photo, but it cannot reproduce how a real
          film looks in your room.{' '}
          <Link to="/advice/colour-on-screen" className="underline hover:text-green">
            Why screens differ from paint
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
