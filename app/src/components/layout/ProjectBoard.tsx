import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, Trash2, X, Share2, ArrowRight } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { colorsByIds, COLOR_LRV } from '../../data/colors'
import { PRODUCTS } from '../../data/products'
import { Button, ButtonLink } from '../ui/Button'
import { cn } from '../../lib/cn'
import { track } from '../../lib/analytics'
import { EmptyState } from '../ui/EmptyState'

/**
 * The project board is the spine of the whole site: a visitor can save colours
 * and products anywhere, then turn that collection into a quote request, a
 * shareable link, or a printable reference for a painter.
 */
export function ProjectBoard() {
  const { board, boardOpen, setBoardOpen, removeColor, toggleProduct, renameBoard, clearBoard } = useApp()
  const [copied, setCopied] = useState(false)
  const paneRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLInputElement>(null)

  const colours = useMemo(() => colorsByIds(board.savedColors), [board.savedColors])
  const products = useMemo(
    () => board.savedProducts.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean),
    [board.savedProducts],
  )

  const share = async () => {
    const url = `${window.location.origin}/colours?scheme=${board.savedColors.join(',')}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      track('cta_click', { target: 'share-project-board', count: board.savedColors.length })
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      window.prompt('Copy this link to share your board:', url)
    }
  }

  // The board is a dialog, not just a panel: it takes focus when it opens,
  // Escape closes it, focus returns to where the visitor was, and the page
  // behind it stops scrolling. The component returns null when closed, so
  // there is nothing hidden but focusable in the tree.
  useEffect(() => {
    if (!boardOpen) return
    const previous = document.activeElement as HTMLElement | null
    headingRef.current?.focus()
    headingRef.current?.select()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setBoardOpen(false)
      }
      if (event.key !== 'Tab') return
      const items = Array.from(
        paneRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
      previous?.focus?.()
    }
  }, [boardOpen, setBoardOpen])

  if (!boardOpen) return null

  return (
    <div className="fixed inset-0 z-[95]">
      <button
        type="button"
        aria-label="Close project board"
        className="absolute inset-0 cursor-default bg-ink/50 backdrop-blur-[2px]"
        onClick={() => setBoardOpen(false)}
      />
      <aside
        ref={paneRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your project board"
        className="absolute inset-y-0 right-0 flex w-full max-w-[27rem] flex-col bg-paper-2 shadow-[0_0_120px_-20px_rgba(11,26,19,0.6)] animate-[slide-left_0.45s_var(--ease-out-quint)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-5">
          <div className="min-w-0 flex-1">
            <p className="kicker text-moss">Your project</p>
            <input
              ref={headingRef}
              value={board.boardName}
              onChange={(event) => renameBoard(event.target.value)}
              aria-label="Project name"
              className="mt-2 w-full border-b border-transparent bg-transparent pb-1 font-[var(--font-display)] text-2xl font-medium tracking-[-0.02em] outline-none transition-colors hover:border-ink/20 focus:border-green"
            />
            <p className="mt-1.5 text-[0.74rem] text-ink/60">
              Saved on this device · {colours.length} colour{colours.length === 1 ? '' : 's'} ·{' '}
              {products.length} product{products.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBoardOpen(false)}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/15 transition-colors hover:bg-ink hover:text-paper-2"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {colours.length === 0 && products.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              body="Tap the bookmark on any colour or product. Your selection stays on this device until you clear it, and you can send it to us as one quote request."
              action={<ButtonLink to="/colours" size="sm">Explore colours</ButtonLink>}
            />
          ) : null}

          {colours.length > 0 ? (
            <section aria-labelledby="board-colours" className="mb-6">
              <h3 id="board-colours" className="kicker mb-3 text-ink/60">
                Colours
              </h3>
              <ul className="space-y-2">
                {colours.map((colour) => (
                  <li
                    key={colour.id}
                    className="group flex items-center gap-3 rounded-sm border border-ink/10 bg-white/45 p-2 transition-colors hover:border-ink/25"
                  >
                    <Link to={`/colours/${colour.id}`} onClick={() => setBoardOpen(false)} className="shrink-0">
                      <span
                        className="block size-11 rounded-[3px] ring-1 ring-inset ring-black/10"
                        style={{ background: colour.hex }}
                        aria-hidden
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/colours/${colour.id}`}
                        onClick={() => setBoardOpen(false)}
                        className="block truncate text-[0.86rem] font-semibold hover:text-green"
                      >
                        {colour.name}
                      </Link>
                      <p className="truncate text-[0.7rem] text-ink/60">
                        {colour.code} · LRV ≈ {COLOR_LRV(colour)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/room-preview?colour=${colour.id}`}
                        onClick={() => setBoardOpen(false)}
                        className="hidden rounded px-2 py-1 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-green hover:bg-green/10 group-hover:block"
                      >
                        Preview
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeColor(colour.id)}
                        className="grid size-8 place-items-center rounded-full text-ink/60 transition-colors hover:bg-crimson/10 hover:text-crimson"
                        aria-label={`Remove ${colour.name} from project`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {products.length > 0 ? (
            <section aria-labelledby="board-products" className="mb-6">
              <h3 id="board-products" className="kicker mb-3 text-ink/60">
                Products
              </h3>
              <ul className="space-y-2">
                {products.map((product) =>
                  product ? (
                    <li
                      key={product.id}
                      className="flex items-center justify-between gap-3 rounded-sm border border-ink/10 bg-white/45 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/products/${product.id}`}
                          onClick={() => setBoardOpen(false)}
                          className="block truncate text-[0.86rem] font-semibold hover:text-green"
                        >
                          {product.name}
                        </Link>
                        <p className="text-[0.7rem] text-ink/60">
                          {product.finish} · {product.coveragePerUnit} m² per litre
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        className="grid size-8 shrink-0 place-items-center rounded-full text-ink/60 transition-colors hover:bg-crimson/10 hover:text-crimson"
                        aria-label={`Remove ${product.name} from project`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          ) : null}

          {colours.length > 0 ? (
            <section aria-labelledby="board-scheme" className="mb-4">
              <h3 id="board-scheme" className="kicker mb-3 text-ink/60">
                Your scheme as a band
              </h3>
              <div className="flex h-14 overflow-hidden rounded-[3px] ring-1 ring-inset ring-black/10">
                {colours.map((colour) => (
                  <span
                    key={colour.id}
                    className="flex-1 transition-[flex-grow] duration-500 hover:flex-[2]"
                    style={{ background: colour.hex }}
                    title={`${colour.name} ${colour.hex}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-[0.72rem] text-ink/60">
                Screens cannot guarantee a physical match. Confirm with a sample pot or dealer chip.
              </p>
            </section>
          ) : null}
        </div>

        <footer className="space-y-2 border-t border-ink/10 bg-paper px-5 py-4">
          <ButtonLink
            to="/quote?from=board"
            fullWidth
            onClick={() => track('cta_click', { target: 'board-to-quote', count: colours.length })}
          >
            Request a quote for this project <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="paper" size="sm" onClick={share} disabled={!colours.length}>
              {copied ? <Check className="size-3.5" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
              {copied ? 'Link copied' : 'Share link'}
            </Button>
            <Button variant="paper" size="sm" onClick={clearBoard} disabled={!colours.length && !products.length}>
              <Trash2 className="size-3.5" aria-hidden /> Clear
            </Button>
          </div>
          <p className={cn('flex items-center justify-center gap-1.5 pt-1 text-[0.68rem] text-ink/60')}>
            <Copy className="size-3" aria-hidden /> Stored only in this browser
          </p>
        </footer>
      </aside>
    </div>
  )
}
