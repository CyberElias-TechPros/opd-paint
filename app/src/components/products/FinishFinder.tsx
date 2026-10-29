import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { PRODUCTS, type Finish, type Surface } from '../../data/products'
import { cn } from '../../lib/cn'
import { track } from '../../lib/analytics'

const SURFACE_OPTIONS: Surface[] = [
  'Interior walls',
  'Ceilings',
  'Bathrooms & kitchens',
  'Exterior walls',
  'Wood & metal',
  'New plaster',
]

type Priority = 'durable' | 'flat' | 'weather' | 'none'

const PRIORITIES: { id: Priority; label: string; detail: string }[] = [
  { id: 'durable', label: 'Easy to clean', detail: 'A surface that gets touched, splashed or scrubbed.' },
  { id: 'flat', label: 'Flattest look', detail: 'Hides imperfections, no sheen, a calm finish.' },
  { id: 'weather', label: 'Faces the weather', detail: 'Rain, sun or salt air on the outside of the building.' },
  { id: 'none', label: "I'm not sure", detail: 'Show everything suitable, ranked by what most people choose.' },
]

/** Higher is glossier. Used only to rank matches, never shown as a raw number. */
function score(product: (typeof PRODUCTS)[number], priority: Priority): number {
  if (priority === 'durable') return product.sheenLevel
  if (priority === 'flat') return -product.sheenLevel
  if (priority === 'weather') return product.surfaces.includes('Exterior walls') ? 100 - product.coatsRecommended : -100
  return -product.coatsRecommended // fewer coats, less project time, as a neutral default
}

function reason(product: (typeof PRODUCTS)[number], surface: Surface, priority: Priority): string {
  if (priority === 'durable') return `${product.finish} finish, rated for ${surface.toLowerCase()} that gets wiped down.`
  if (priority === 'flat') return `A flat ${product.finish.toLowerCase()} finish that forgives an imperfect surface.`
  if (priority === 'weather') return `Built for exterior exposure — ${product.bestFor.toLowerCase()}`
  return `${product.bestFor}`
}

/**
 * A guided flow, not a filter: three short questions instead of two dropdowns
 * shown at once. It hands its answer back to the page's existing finish/
 * surface filters (`onApply`) rather than duplicating the product grid.
 */
export function FinishFinder({ onApply }: { onApply: (finish: Finish | 'All', surface: Surface) => void }) {
  const [open, setOpen] = useState(false)
  const [surface, setSurface] = useState<Surface | null>(null)
  const [priority, setPriority] = useState<Priority | null>(null)

  const candidates = useMemo(() => {
    if (!surface || !priority) return []
    return [...PRODUCTS]
      .filter((product) => product.surfaces.includes(surface))
      .sort((a, b) => score(b, priority) - score(a, priority))
  }, [surface, priority])

  const reset = () => {
    setSurface(null)
    setPriority(null)
  }

  const step = !surface ? 1 : !priority ? 2 : 3

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          track('cta_click', { target: 'finish-finder-open' })
        }}
        className="mb-6 flex w-full items-center justify-between gap-3 rounded-sm border border-ink/14 bg-paper-2/60 px-5 py-4 text-left transition-colors hover:border-green"
      >
        <span className="flex items-center gap-3">
          <Sparkles className="size-4 shrink-0 text-green" aria-hidden />
          <span>
            <span className="block text-[0.92rem] font-semibold">Not sure which finish?</span>
            <span className="block text-[0.76rem] text-ink/68">Answer two questions and we'll point to the right product.</span>
          </span>
        </span>
        <span className="shrink-0 text-[0.76rem] font-bold uppercase tracking-[0.08em] text-green">Start</span>
      </button>
    )
  }

  return (
    <div className="mb-6 rounded-sm border border-ink/14 bg-paper-2/60 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="kicker text-moss">Finish finder · step {step} of 3</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-ink/60 hover:text-ink">
          Close
        </button>
      </div>

      {step === 1 ? (
        <>
          <h2 className="mt-3 font-[var(--font-display)] text-[1.25rem]">What are you painting?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SURFACE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSurface(option)}
                className="rounded-sm border border-ink/14 bg-paper px-4 py-3 text-left text-[0.86rem] font-semibold transition-colors hover:border-green hover:text-green"
              >
                {option}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <button type="button" onClick={() => setSurface(null)} className="mt-3 flex items-center gap-1 text-[0.74rem] font-bold text-ink/60 hover:text-ink">
            <ChevronLeft className="size-3.5" aria-hidden /> Back
          </button>
          <h2 className="mt-2 font-[var(--font-display)] text-[1.25rem]">What matters most?</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PRIORITIES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setPriority(option.id)
                  track('cta_click', { target: 'finish-finder-complete', surface: surface ?? '', priority: option.id })
                }}
                className="rounded-sm border border-ink/14 bg-paper px-4 py-3 text-left transition-colors hover:border-green"
              >
                <span className="block text-[0.86rem] font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[0.72rem] text-ink/68">{option.detail}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 3 && surface && priority ? (
        <>
          <button type="button" onClick={() => setPriority(null)} className="mt-3 flex items-center gap-1 text-[0.74rem] font-bold text-ink/60 hover:text-ink">
            <ChevronLeft className="size-3.5" aria-hidden /> Back
          </button>
          {candidates.length ? (
            <>
              <h2 className="mt-2 font-[var(--font-display)] text-[1.25rem]">
                For {surface.toLowerCase()}, start with {candidates[0].shortName}.
              </h2>
              <ul className="mt-4 space-y-3">
                {candidates.slice(0, 3).map((product, index) => (
                  <li key={product.id} className={cn('rounded-sm border p-4', index === 0 ? 'border-green bg-green/6' : 'border-ink/12 bg-paper')}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/products/${product.id}`} className="font-[var(--font-display)] text-[1.05rem] hover:text-green">
                        {product.name}
                      </Link>
                      {index === 0 ? <span className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-green">Best match</span> : null}
                    </div>
                    <p className="mt-1 text-[0.82rem] leading-relaxed text-ink/72">{reason(product, surface, priority)}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onApply(candidates[0].finish, surface)
                    setOpen(false)
                  }}
                  className="rounded-[3px] bg-ink px-5 py-2.5 text-[0.8rem] font-bold text-paper-2 hover:bg-green-deep"
                >
                  Show these in the list below
                </button>
                <button type="button" onClick={reset} className="text-[0.8rem] font-bold text-ink/60 hover:text-ink">
                  Start over
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[0.86rem] text-ink/72">
              Nothing in the range is specified for that combination yet — call the colour desk and we'll confirm
              what to use.
            </p>
          )}
        </>
      ) : null}
    </div>
  )
}
