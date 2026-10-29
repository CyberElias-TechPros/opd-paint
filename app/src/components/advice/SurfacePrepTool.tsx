import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ListChecks } from 'lucide-react'
import { PREP_CONDITIONS } from '../../data/surfacePrep'
import { PRODUCTS } from '../../data/products'
import { findGuide } from '../../data/guides'
import { cn } from '../../lib/cn'
import { track } from '../../lib/analytics'
import { ArrowLink } from '../ui/Bits'

/**
 * "Tell us the situation, get the sequence" — a decision tool built entirely
 * from the sequence already written out in `preparing-walls` and
 * `damp-and-mould` (see `data/surfacePrep.ts`). It does not replace those
 * guides, it is the quick-reference a painter standing in front of a wall
 * actually wants before reading nine paragraphs.
 */
export function SurfacePrepTool() {
  const [selected, setSelected] = useState<string | null>(null)
  const condition = PREP_CONDITIONS.find((item) => item.id === selected) ?? null
  const guide = condition ? findGuide(condition.relatedGuide) : undefined
  const products = condition
    ? condition.relatedProducts.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean)
    : []

  const choose = (id: string) => {
    setSelected(id)
    track('cta_click', { target: 'surface-prep-tool', condition: id })
  }

  return (
    <div className="rounded-sm border border-ink/12 bg-paper-2/50 p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper-2">
          <ListChecks className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="font-[var(--font-display)] text-[1.35rem]">What's the wall doing right now?</h2>
          <p className="mt-1 text-[0.86rem] leading-relaxed text-ink/72">
            Pick the closest match and get the preparation sequence, in order — not a filter, a plan.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2" role="group" aria-label="Wall condition">
        {PREP_CONDITIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === item.id}
            onClick={() => choose(item.id)}
            className={cn(
              'rounded-sm border px-4 py-3 text-left transition-colors',
              selected === item.id
                ? 'border-green bg-green/8'
                : 'border-ink/14 bg-paper hover:border-ink/30',
            )}
          >
            <span className="block text-[0.86rem] font-semibold">{item.label}</span>
            <span className="mt-0.5 block text-[0.74rem] leading-snug text-ink/68">{item.description}</span>
          </button>
        ))}
      </div>

      {condition ? (
        <div className="mt-7 border-t border-ink/12 pt-6">
          {condition.warning ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-sm border-l-2 border-crimson bg-crimson/6 p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden />
              <p className="text-[0.86rem] leading-relaxed text-ink/80">{condition.warning}</p>
            </div>
          ) : null}

          <h3 className="kicker mb-3 text-ink/72">Do this, in order</h3>
          <ol className="space-y-3">
            {condition.steps.map((step, index) => (
              <li key={step.slice(0, 24)} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-ink/25 text-[0.68rem] font-bold">
                  {index + 1}
                </span>
                <p className="text-[0.92rem] leading-relaxed text-ink/78">{step}</p>
              </li>
            ))}
          </ol>

          {products.length ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-ink/60">
                Products used here:
              </span>
              {products.map((product) =>
                product ? (
                  <Link
                    key={product.id}
                    to={`/products/${product.id}`}
                    className="rounded-full border border-ink/18 px-3 py-1 text-[0.76rem] font-semibold hover:border-green hover:text-green"
                  >
                    {product.shortName}
                  </Link>
                ) : null,
              )}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            {guide ? (
              <ArrowLink to={`/advice/${guide.id}`} className="text-green">
                Read the full guide: {guide.title}
              </ArrowLink>
            ) : null}
            <Link
              to="/quote"
              className="inline-flex items-center gap-1.5 text-[0.82rem] font-bold text-ink hover:text-green"
            >
              Not sure? Ask the technical desk <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
