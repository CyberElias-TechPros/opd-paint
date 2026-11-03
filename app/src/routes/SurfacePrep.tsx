import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ClipboardList, Hammer, Ruler, TriangleAlert } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { PREP_SITUATIONS, findPrepSituation } from '../data/tools'
import { findProduct } from '../data/products'
import { findGuide } from '../data/guides'
import { Kicker, Badge, ArrowLink } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { useApp } from '../store/AppStore'
import { track } from '../lib/analytics'
import { cn } from '../lib/cn'

/**
 * Surface-preparation decision support (roadmap 11.02.02).
 *
 * The guides already carry this reasoning as prose; what a person standing in
 * front of a failing wall needs is the sequence for *their* situation, in order,
 * with the products that go with it. Every step here is traceable to a published
 * guide — the ids are listed on the page and checked by the content tests, so
 * this page cannot become a second, unreviewed source of technical advice.
 */
export default function SurfacePrep() {
  const [params] = useSearchParams()
  const { togglePrep, board, toast } = useApp()
  const [query, setQuery] = useState('')

  const requested = params.get('situation')
  const situation = requested ? findPrepSituation(requested) : undefined

  useEffect(() => {
    if (!situation) return
    track('tool_start', { tool: 'surface-prep', situation: situation.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situation?.id])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PREP_SITUATIONS
    return PREP_SITUATIONS.filter((entry) =>
      `${entry.label} ${entry.signs.join(' ')} ${entry.surfaces.join(' ')}`.toLowerCase().includes(q),
    )
  }, [query])

  usePageMeta({
    title: situation ? `Preparing ${situation.label.toLowerCase()}` : 'Surface preparation',
    description: situation
      ? `${situation.label}: how to recognise it, the preparation sequence in order, the products to use and the guides behind each step. Paint is a coating, not a repair.`
      : 'Preparation sequences for new render, sound repaints, flaking paint, uneven walls, chalky surfaces, damp, mould, salt bloom, old gloss and coastal exposure — each with the products and the reasoning.',
    path: '/tools/surface-prep',
    image: '/media/project-cream-scaffold.webp',
    jsonLd: situation
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: `Preparing ${situation.label.toLowerCase()}`,
          description: situation.signs.join(' '),
          step: situation.steps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.step,
            text: step.detail,
          })),
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'OPUDA’S PAINT surface preparation sequences',
          itemListElement: PREP_SITUATIONS.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.label,
            url: `https://opudapaint.com/tools/surface-prep?situation=${entry.id}`,
          })),
        },
  })

  const addToProject = () => {
    if (!situation) return
    if (!board.prep.includes(situation.id)) togglePrep(situation.id)
    track('tool_complete', { tool: 'surface-prep', situation: situation.id })
    toast('Preparation added to your project', {
      description: 'It now appears in your project checklist, in the right order.',
    })
  }

  /* ------------------------------------------------------------- detail view */
  if (situation) {
    const products = situation.products.map((id) => findProduct(id)).filter((product) => product !== undefined)
    const guides = situation.guides.map((id) => findGuide(id)).filter((guide) => guide !== undefined)
    const inProject = board.prep.includes(situation.id)

    return (
      <>
        <header className="border-b border-ink/10 bg-paper-2/40">
          <div className="shell py-10 sm:py-12">
            <nav aria-label="Breadcrumb" className="mb-5">
              <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] text-ink/72">
                <li>
                  <Link to="/tools" className="hover:text-ink">
                    Tools
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link to="/tools/surface-prep" className="hover:text-ink">
                    Surface preparation
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="font-semibold text-ink/70">
                  {situation.label}
                </li>
              </ol>
            </nav>
            <Kicker className="mb-4">Preparation sequence</Kicker>
            <h1 className="display max-w-3xl text-[clamp(2.1rem,4.4vw,3.4rem)]">{situation.label}</h1>
            <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/75">
              {situation.steps.length} steps, in the order they have to happen. Surfaces: {situation.surfaces.join(', ')}.
            </p>
          </div>
        </header>

        <div className="shell grid gap-8 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-12">
          <div>
            <section aria-labelledby="signs-title" className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <h2 id="signs-title" className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ink/72">
                How to recognise it
              </h2>
              <ul className="mt-3 space-y-1.5">
                {situation.signs.map((sign) => (
                  <li key={sign} className="flex gap-2 text-[0.86rem] leading-relaxed text-ink/75">
                    <Check className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
                    {sign}
                  </li>
                ))}
              </ul>
            </section>

            {situation.warnings.length ? (
              <section aria-labelledby="warnings-title" className="mt-4 space-y-2">
                <h2 id="warnings-title" className="sr-only">
                  Warnings
                </h2>
                {situation.warnings.map((warning) => (
                  <p
                    key={warning}
                    className="flex items-start gap-2 rounded-sm border border-crimson/30 bg-crimson/5 p-3.5 text-[0.84rem] leading-relaxed text-crimson"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {warning}
                  </p>
                ))}
              </section>
            ) : null}

            <section aria-labelledby="steps-title" className="mt-6">
              <h2 id="steps-title" className="display text-[clamp(1.5rem,3vw,2.1rem)]">
                The sequence
              </h2>
              <ol className="mt-4 space-y-3">
                {situation.steps.map((step, index) => (
                  <li key={step.step} className="flex gap-4 rounded-sm border border-ink/12 bg-paper-2/50 p-4">
                    <span className="tabular grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[0.8rem] font-bold text-paper-2">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-[0.95rem] font-semibold">{step.step}</h3>
                      <p className="mt-1 text-[0.85rem] leading-relaxed text-ink/72">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <p className="kicker mb-3 text-ink/72">Products in this sequence</p>
              <ul className="space-y-2">
                {products.map((product) => (
                  <li key={product.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <Link to={`/products/${product.id}`} className="block text-[0.88rem] font-semibold hover:text-green">
                        {product.name}
                      </Link>
                      <span className="block text-[0.72rem] text-ink/72">
                        {product.finish} · {product.coveragePerUnit} m² per {product.packs[0]?.unit ?? 'L'} per coat
                      </span>
                    </span>
                    <Badge tone={product.claimsStatus === 'label-verified' ? 'green' : 'line'}>
                      {product.claimsStatus === 'label-verified' ? 'Label' : 'In review'}
                    </Badge>
                  </li>
                ))}
                {!products.length ? (
                  <li className="text-[0.82rem] text-ink/72">
                    No product from this range is part of this sequence — it is a building repair first.
                  </li>
                ) : null}
              </ul>
              <div className="mt-4 space-y-2">
                <Button size="sm" fullWidth onClick={addToProject} aria-pressed={inProject} variant={inProject ? 'paper' : 'solid'}>
                  <ClipboardList className="size-4" aria-hidden />
                  {inProject ? 'In your project checklist' : 'Add to my project checklist'}
                </Button>
                <ButtonLink
                  to={
                    situation.condition
                      ? `/tools/finish-finder?condition=${situation.condition}`
                      : '/tools/finish-finder'
                  }
                  size="sm"
                  variant="outline"
                  fullWidth
                >
                  <Hammer className="size-4" aria-hidden /> Choose the finish for it
                </ButtonLink>
                <ButtonLink to="/calculator" size="sm" variant="ghost" fullWidth>
                  <Ruler className="size-4" aria-hidden /> Work out the quantities
                </ButtonLink>
              </div>
            </div>

            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <p className="kicker mb-2 text-ink/72">Where this comes from</p>
              <ul className="space-y-1.5">
                {guides.map((guide) => (
                  <li key={guide.id}>
                    <Link to={`/advice/${guide.id}`} className="group flex items-center justify-between gap-3 text-[0.84rem] hover:text-green">
                      {guide.title}
                      <ArrowRight className="size-3.5 shrink-0 text-ink/40 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.72rem] leading-relaxed text-ink/72">
                Reviewed by {guides[0]?.reviewer ?? 'the OPUDA’S technical desk'} · updated{' '}
                {guides[0]?.updated ?? '2026'}
              </p>
            </div>

            <ArrowLink to="/tools/surface-prep">All preparation situations</ArrowLink>
          </aside>
        </div>
      </>
    )
  }

  /* -------------------------------------------------------------- index view */
  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-12">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] text-ink/72">
              <li>
                <Link to="/tools" className="hover:text-ink">
                  Tools
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-semibold text-ink/70">
                Surface preparation
              </li>
            </ol>
          </nav>
          <Kicker className="mb-4">Surface preparation</Kicker>
          <h1 className="display max-w-3xl text-[clamp(2.1rem,4.4vw,3.4rem)]">
            The wall decides <span className="italic">before the paint does.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/75">
            Pick the situation you are standing in front of. Each one gives you the sequence in order, the products it
            needs, and the guide that explains why — including the cases where the honest answer is that paint is not the
            repair.
          </p>
          {requested ? (
            <p role="status" className="mt-4 rounded-sm border border-ink/15 bg-paper-2/70 px-3 py-2 text-[0.8rem] text-ink/72">
              No preparation sequence called “{requested}”. It may be an old link — the situations are listed below.
            </p>
          ) : null}
        </div>
      </header>

      <section className="shell py-8">
        <label className="sr-only" htmlFor="prep-search">
          Search preparation situations
        </label>
        <input
          id="prep-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search: damp, gloss, salt, blockwork…"
          className="field max-w-md py-2 text-[0.86rem]"
        />

        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {filtered.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/tools/surface-prep?situation=${entry.id}`}
                className="group flex h-full flex-col rounded-sm border border-ink/12 bg-paper-2/60 p-4 transition-colors hover:border-ink/35"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-[var(--font-display)] text-[1.2rem] leading-tight">{entry.label}</span>
                  <ArrowRight
                    className="mt-1 size-4 shrink-0 text-ink/40 transition-transform group-hover:translate-x-1 group-hover:text-green"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink/72">
                  {entry.surfaces.join(' · ')}
                </span>
                <span className="mt-2 flex-1 text-[0.82rem] leading-relaxed text-ink/72">
                  {entry.signs[0]}
                  {entry.signs.length > 1 ? ` ${entry.signs[1]}` : ''}
                </span>
                <span className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-ink/72">
                  <span className="rounded-full bg-ink/6 px-2 py-0.5 font-semibold">{entry.steps.length} steps</span>
                  {entry.warnings.length ? (
                    <span className="rounded-full bg-crimson/8 px-2 py-0.5 font-semibold text-crimson">
                      {entry.warnings.length} warning{entry.warnings.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  {board.prep.includes(entry.id) ? (
                    <span className="rounded-full bg-green/10 px-2 py-0.5 font-semibold text-green">In your project</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
          {!filtered.length ? (
            <li className="md:col-span-2">
              <div className="rounded-sm border border-dashed border-ink/20 bg-white/40 px-6 py-10 text-center">
                <p className="font-[var(--font-display)] text-lg">Nothing matches “{query}”</p>
                <p className="mx-auto mt-2 max-w-sm text-[0.82rem] leading-relaxed text-ink/72">
                  Try a symptom rather than a product: damp, flaking, chalky, salt, gloss, blockwork. If the surface is
                  doing something not listed here, send us a photograph — the technical desk answers those.
                </p>
                <div className="mt-5 flex justify-center">
                  <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                    Clear the search
                  </Button>
                </div>
              </div>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="shell pb-16">
        <div
          className={cn(
            'rounded-sm border border-ink/12 bg-paper-2/50 p-5 sm:p-7',
          )}
        >
          <h2 className="display text-[clamp(1.4rem,3vw,2rem)]">The two rules behind every sequence</h2>
          <ol className="mt-3 grid gap-4 sm:grid-cols-2">
            <li className="text-[0.86rem] leading-relaxed text-ink/72">
              <span className="font-semibold text-ink">Fix the cause, then coat.</span> Moisture, salt and movement are
              building problems. A coating over an active one fails from behind, and no topcoat repairs that.
            </li>
            <li className="text-[0.86rem] leading-relaxed text-ink/72">
              <span className="font-semibold text-ink">Adhesion is won in the dust.</span> Clean, dry, sound and primed
              beats an expensive finish every time. Dust is the reason most coats lift.
            </li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <ArrowLink to="/advice/preparing-walls">Preparing walls in Nigerian weather</ArrowLink>
            <ArrowLink to="/advice/damp-and-mould">Damp, mould and what paint cannot fix</ArrowLink>
          </div>
        </div>
      </section>
    </>
  )
}
