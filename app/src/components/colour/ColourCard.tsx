import { Bookmark, BookmarkCheck, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { COLOR_LRV, type PaintColor } from '../../data/colors'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/AppStore'

/**
 * A swatch is never just a colour block: the name and code are part of the
 * control so the information is available without relying on sight alone
 * (WCAG 1.4.1 — colour is not the only carrier of meaning).
 */
export function ColourCard({
  colour,
  height = 'regular',
  showMeta = true,
}: {
  colour: PaintColor
  height?: 'regular' | 'tall' | 'compact'
  showMeta?: boolean
}) {
  const { isSaved, toggleColor } = useApp()
  const saved = isSaved(colour.id)

  return (
    <article className="group/sw relative">
      <Link
        to={`/colours/${colour.id}`}
        className="block focus-visible:outline-offset-4"
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-[3px] ring-1 ring-inset ring-black/10 transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-quint)] group-hover/sw:-translate-y-1 group-hover/sw:shadow-[0_22px_50px_-28px_rgba(11,26,19,0.55)]',
            height === 'tall' && 'aspect-[3/4]',
            height === 'regular' && 'aspect-[4/3]',
            height === 'compact' && 'aspect-square',
          )}
          style={{ background: colour.hex }}
        >
          {/*
            The caption sits on a paper plate rather than directly on the paint.
            Seven colours in the library are mid-tone values where neither black
            nor white small text reaches 4.5:1, so a plate is the only way this
            stays readable across the whole set (colour.ts `swatchText`).
          */}
          <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-2 bg-paper-2/95 px-3 py-2 text-ink backdrop-blur-sm transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover/sw:translate-y-0 group-focus-within/sw:translate-y-0">
            <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink/72">{colour.code}</span>
            <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold">
              <Eye className="size-3.5" aria-hidden /> Preview
            </span>
          </div>
        </div>
        {showMeta ? (
          <div className="mt-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[0.85rem] font-semibold leading-tight">{colour.name}</p>
              <p className="mt-0.5 truncate text-[0.7rem] text-ink/72">
                {colour.family} · LRV ≈ {COLOR_LRV(colour)}
              </p>
            </div>
          </div>
        ) : null}
        <span className="sr-only">Open colour details.</span>
      </Link>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          toggleColor(colour.id)
        }}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${colour.name} from your project` : `Save ${colour.name} to your project`}
        className={cn(
          'absolute right-2 top-2 grid size-8 place-items-center rounded-full backdrop-blur transition-all duration-300',
          saved
            ? 'bg-ink text-paper-2 opacity-100'
            : 'bg-paper-2/85 text-ink/72 opacity-0 hover:bg-paper-2 hover:text-ink group-hover/sw:opacity-100 focus-visible:opacity-100',
        )}
      >
        {saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
      </button>
    </article>
  )
}

export function ColourStrip({
  hexes,
  label,
  className,
}: {
  hexes: string[]
  label?: string
  className?: string
}) {
  return (
    <div className={cn('flex overflow-hidden rounded-full ring-1 ring-inset ring-black/10', className)} aria-hidden>
      {hexes.map((hex, index) => (
        <span key={`${hex}-${index}`} className="h-full flex-1" style={{ background: hex }} />
      ))}
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  )
}
