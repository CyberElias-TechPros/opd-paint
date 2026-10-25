import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, FileDown, LayoutGrid, Printer, Search, SlidersHorizontal, X } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { COLORS, COLLECTIONS, COLOR_LRV, FAMILIES, FAMILY_SWATCH, ROOMS, type Family, type Room, type Undertone } from '../data/colors'
import { PALETTES } from '../data/palettes'
import { ColourCard } from '../components/colour/ColourCard'
import { Pill, Kicker, Badge, ArrowLink } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { Reveal } from '../components/motion/Reveal'
import { SmartImage } from '../components/media/SmartImage'
import { EmptyState } from '../components/ui/EmptyState'
import { useApp } from '../store/AppStore'
import { track } from '../lib/analytics'
import { cn } from '../lib/cn'
import { hueOf } from '../lib/color'

type SortKey = 'family' | 'light' | 'dark' | 'hue' | 'name'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'family', label: 'By family' },
  { id: 'light', label: 'Lightest first' },
  { id: 'dark', label: 'Darkest first' },
  { id: 'hue', label: 'By hue' },
  { id: 'name', label: 'A–Z' },
]

export default function Colours() {
  const [params, setParams] = useSearchParams()
  const { toast } = useApp()

  const [query, setQuery] = useState(params.get('q') ?? '')
  const [families, setFamilies] = useState<Family[]>(() => {
    const family = params.get('family')
    return family && FAMILIES.includes(family as Family) ? [family as Family] : []
  })
  const [undertone, setUndertone] = useState<Undertone | 'All'>('All')
  const [room, setRoom] = useState<Room | 'All'>('All')
  const [collection, setCollection] = useState<string>('All')
  const [lrv, setLrv] = useState<[number, number]>([0, 100])
  const [sort, setSort] = useState<SortKey>('family')
  const [view, setView] = useState<'grid' | 'palettes'>(params.get('view') === 'palettes' ? 'palettes' : 'grid')
  const [compare, setCompare] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activePalette = params.get('palette')
  const schemeParam = params.get('scheme')

  usePageMeta({
    title: 'Colour library',
    description:
      'Browse the OPUDA’S PAINT colour library: 60 launch colours with permanent codes, estimated light reflectance values, family and undertone filters, and curated palettes for Nigerian light.',
    path: '/colours',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'OPUDA’S PAINT colour library',
      numberOfItems: COLORS.length,
      itemListElement: COLORS.slice(0, 12).map((colour, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: colour.name,
        url: `https://opudapaint.com/colours/${colour.id}`,
      })),
    },
  })

  // A shared scheme link pre-selects colours for comparison.
  useEffect(() => {
    if (!schemeParam) return
    const ids = schemeParam.split(',').filter((id) => COLORS.some((c) => c.id === id))
    if (ids.length) setCompare(ids.slice(0, 4))
  }, [schemeParam])

  useEffect(() => {
    if (activePalette) setView('palettes')
  }, [activePalette])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = COLORS.filter((colour) => {
      if (families.length && !families.includes(colour.family)) return false
      if (undertone !== 'All' && colour.undertone !== undertone) return false
      if (room !== 'All' && !colour.rooms.includes(room)) return false
      if (collection !== 'All' && colour.collection !== collection) return false
      const value = COLOR_LRV(colour)
      if (value < lrv[0] || value > lrv[1]) return false
      if (q && !`${colour.name} ${colour.code} ${colour.family} ${colour.undertone} ${colour.note}`.toLowerCase().includes(q))
        return false
      return true
    })

    return list.sort((a, b) => {
      switch (sort) {
        case 'light':
          return COLOR_LRV(b) - COLOR_LRV(a)
        case 'dark':
          return COLOR_LRV(a) - COLOR_LRV(b)
        case 'hue':
          return hueOf(a.hex) - hueOf(b.hex)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family) || COLOR_LRV(b) - COLOR_LRV(a)
      }
    })
  }, [query, families, undertone, room, collection, lrv, sort])

  const toggleFamily = (family: Family) => {
    setFamilies((current) => (current.includes(family) ? current.filter((f) => f !== family) : [...current, family]))
    track('colour_filter', { filter: 'family', value: family })
  }

  const toggleCompare = (id: string) => {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((c) => c !== id)
      if (current.length >= 4) {
        toast('Compare holds four colours', { description: 'Remove one to add another.', tone: 'info' })
        return current
      }
      track('colour_compare', { colourId: id })
      return [...current, id]
    })
  }

  const clearAll = () => {
    setQuery('')
    setFamilies([])
    setUndertone('All')
    setRoom('All')
    setCollection('All')
    setLrv([0, 100])
    setParams({})
  }

  const activeFilterCount =
    families.length + (undertone !== 'All' ? 1 : 0) + (room !== 'All' ? 1 : 0) + (collection !== 'All' ? 1 : 0) + (lrv[0] > 0 || lrv[1] < 100 ? 1 : 0)

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">The library</Kicker>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h1 className="display text-[clamp(2.4rem,5vw,4rem)]">
                {COLORS.length} colours, <span className="italic">coded for life.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink/65">
                Every colour carries a permanent code, a family, an undertone and an estimated light reflectance value.
                Save the ones you like — they will be waiting when you come back.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/documents/opudas-fan-deck.pdf"
                download
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-3.5 py-2 text-[0.76rem] font-semibold transition-colors hover:border-ink/40"
              >
                <FileDown className="size-3.5" aria-hidden /> Fan deck
                <span className="text-[0.66rem] font-normal opacity-60">PDF</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  track('cta_click', { target: 'colours-print' })
                  window.print()
                }}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-3.5 py-2 text-[0.76rem] font-semibold transition-colors hover:border-ink/40"
              >
                <Printer className="size-3.5" aria-hidden /> Print list
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[0.76rem] font-semibold transition-colors',
                  view === 'grid' ? 'border-ink bg-ink text-paper-2' : 'border-ink/15 hover:border-ink/40',
                )}
              >
                <LayoutGrid className="size-3.5" aria-hidden /> Library
              </button>
              <button
                type="button"
                onClick={() => setView('palettes')}
                aria-pressed={view === 'palettes'}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[0.76rem] font-semibold transition-colors',
                  view === 'palettes' ? 'border-ink bg-ink text-paper-2' : 'border-ink/15 hover:border-ink/40',
                )}
              >
                Palettes <span className="text-[0.66rem] opacity-60">{PALETTES.length}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {view === 'palettes' ? (
        <section className="shell py-12" aria-label="Curated palettes">
          <ul className="grid gap-6 md:grid-cols-2">
            {PALETTES.map((palette, index) => (
              <li key={palette.id}>
                <Reveal delay={index * 50}>
                  <article
                    className={cn(
                      'overflow-hidden rounded-sm border bg-paper-2/50 transition-shadow',
                      activePalette === palette.id ? 'border-ink shadow-[0_30px_60px_-40px_rgba(11,26,19,0.5)]' : 'border-ink/12',
                    )}
                    id={palette.id}
                  >
                    <div className="grid sm:grid-cols-[0.9fr_1.1fr]">
                      <SmartImage name={palette.image} aspect={1} sizes="(max-width: 640px) 92vw, 30vw" />
                      <div className="p-5">
                        <div className="flex items-center gap-2">
                          <Badge tone="green">{palette.season}</Badge>
                        </div>
                        <h2 className="mt-2 font-[var(--font-display)] text-[1.5rem] leading-tight">{palette.name}</h2>
                        <p className="mt-2 text-[0.82rem] leading-relaxed text-ink/60">{palette.story}</p>
                        <p className="mt-2 text-[0.74rem] text-ink/60">Best for: {palette.bestFor}</p>
                      </div>
                    </div>
                    <div className="border-t border-ink/10">
                      {palette.colors.map((id, i) => {
                        const colour = COLORS.find((c) => c.id === id)
                        if (!colour) return null
                        return (
                          <Link
                            key={id}
                            to={`/colours/${id}`}
                            className="group flex items-center gap-3 border-b border-ink/6 px-4 py-2.5 last:border-0 hover:bg-white/60"
                          >
                            <span className="size-7 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: colour.hex }} aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.84rem] font-semibold">{colour.name}</span>
                              <span className="block text-[0.68rem] text-ink/60">
                                {palette.roles[i]} · {colour.code}
                              </span>
                            </span>
                            <Check className="size-3.5 text-green opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                          </Link>
                        )
                      })}
                    </div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-[0.78rem] leading-relaxed text-ink/60">
            Palettes are editorial recommendations by our colour desk, not colour-matching guarantees. Photographs on
            this page show the finishes as photographed on site.{' '}
            <Link to="/advice/colour-on-screen" className="underline hover:text-green">
              Why that matters
            </Link>
            .
          </p>
        </section>
      ) : (
        <>
          {/* ---------------------------------------------------------- filters */}
          <div className="sticky top-16 z-30 border-b border-ink/10 bg-paper/95 backdrop-blur-xl sm:top-[4.5rem]">
            <div className="shell py-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[13rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/60" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a colour name or code"
                    aria-label="Search colours"
                    className="field py-2 pl-9 text-[0.86rem]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  className="inline-flex items-center gap-2 rounded-[3px] border border-ink/20 px-3 py-2 text-[0.8rem] font-semibold transition-colors hover:border-ink lg:hidden"
                >
                  <SlidersHorizontal className="size-4" aria-hidden /> Filters
                  {activeFilterCount ? (
                    <span className="grid size-5 place-items-center rounded-full bg-ink text-[0.62rem] text-paper-2">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>

                <label className="hidden items-center gap-2 text-[0.74rem] text-ink/60 lg:flex">
                  Sort
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    className="field w-auto py-1.5 text-[0.78rem]"
                    aria-label="Sort colours"
                  >
                    {SORTS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {activeFilterCount > 0 || query ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.76rem] font-semibold text-ink/60 hover:text-ink"
                  >
                    <X className="size-3.5" aria-hidden /> Clear
                  </button>
                ) : null}
              </div>

              <div className={cn('mt-2', filtersOpen ? 'block' : 'hidden lg:block')}>
                <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                  {FAMILIES.map((family) => (
                    <Pill
                      key={family}
                      active={families.includes(family)}
                      onClick={() => toggleFamily(family)}
                      dot={FAMILY_SWATCH[family]}
                    >
                      {family.replace(' & ', ' / ')}
                    </Pill>
                  ))}
                </div>
                <div className="mt-2 grid gap-3 border-t border-ink/8 pt-2 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex items-center justify-between gap-2 text-[0.72rem] font-semibold text-ink/60">
                    Undertone
                    <select
                      value={undertone}
                      onChange={(event) => setUndertone(event.target.value as Undertone | 'All')}
                      className="field w-auto py-1.5 text-[0.76rem]"
                    >
                      {['All', 'Warm', 'Cool', 'Neutral'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-2 text-[0.72rem] font-semibold text-ink/60">
                    Room
                    <select
                      value={room}
                      onChange={(event) => setRoom(event.target.value as Room | 'All')}
                      className="field w-auto py-1.5 text-[0.76rem]"
                    >
                      <option value="All">Any room</option>
                      {ROOMS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-2 text-[0.72rem] font-semibold text-ink/60">
                    Collection
                    <select
                      value={collection}
                      onChange={(event) => setCollection(event.target.value)}
                      className="field w-auto py-1.5 text-[0.76rem]"
                    >
                      <option value="All">All collections</option>
                      {COLLECTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-[0.72rem] font-semibold text-ink/60">
                    <span className="flex items-center justify-between">
                      LRV ≈
                      <span className="tabular text-ink/60">
                        {lrv[0]}–{lrv[1]}
                      </span>
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={lrv[0]}
                        onChange={(event) => setLrv([Math.min(Number(event.target.value), lrv[1]), lrv[1]])}
                        aria-label="Minimum light reflectance value"
                        className="flex-1"
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={lrv[1]}
                        onChange={(event) => setLrv([lrv[0], Math.max(Number(event.target.value), lrv[0])])}
                        aria-label="Maximum light reflectance value"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------ grid */}
          <section className="shell py-8" aria-live="polite">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[0.82rem] text-ink/60">
                <span className="tabular text-[1.05rem] font-semibold text-ink">{filtered.length}</span> colour
                {filtered.length === 1 ? '' : 's'}
                {families.length ? ` in ${families.join(', ')}` : ''}
              </p>
              <p className="text-[0.72rem] text-ink/60">LRV values are estimated from the digital value</p>
            </div>

            {filtered.length ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filtered.map((colour, index) => (
                  <Reveal key={colour.id} delay={Math.min(index * 18, 240)}>
                    <div className="group/compare relative">
                      <ColourCard colour={colour} height="tall" />
                      <button
                        type="button"
                        onClick={() => toggleCompare(colour.id)}
                        aria-pressed={compare.includes(colour.id)}
                        className={cn(
                          'absolute right-2 top-12 rounded-full border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] transition-all',
                          compare.includes(colour.id)
                            ? 'border-ink bg-ink text-paper-2'
                            : 'border-ink/20 bg-paper-2/85 text-ink/60 opacity-0 hover:border-ink hover:text-ink group-hover/compare:opacity-100 focus-visible:opacity-100',
                        )}
                      >
                        {compare.includes(colour.id) ? 'Comparing' : 'Compare'}
                      </button>
                    </div>
                  </Reveal>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No colours match those filters"
                body="Try widening the LRV range, clearing a family, or searching for a code such as OP-201."
                action={<Button onClick={clearAll}>Clear all filters</Button>}
              />
            )}
          </section>
        </>
      )}

      {/* ---------------------------------------------------- compare tray */}
      {compare.length ? (
        <div className="sticky bottom-4 z-40 mx-auto w-[min(94vw,64rem)]">
          <div className="rounded-sm border border-ink/20 bg-paper-2/97 p-3 shadow-[0_30px_80px_-40px_rgba(11,26,19,0.8)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="kicker text-ink/60">Comparing {compare.length}/4</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCompare([])}
                >
                  Clear
                </Button>
                <ButtonLink
                  size="sm"
                  to={`/quote?from=compare&colours=${compare.join(',')}`}
                >
                  Request samples
                </ButtonLink>
              </div>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {compare.map((id) => {
                const colour = COLORS.find((c) => c.id === id)
                if (!colour) return null
                return (
                  <div key={id} className="flex w-28 shrink-0 flex-col">
                    <div className="h-16 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: colour.hex }} />
                    <div className="mt-1 flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="truncate text-[0.7rem] font-semibold">{colour.name}</p>
                        <p className="text-[0.62rem] text-ink/60">LRV ≈ {COLOR_LRV(colour)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCompare(id)}
                        className="grid size-5 shrink-0 place-items-center rounded-full text-ink/60 hover:bg-ink/10 hover:text-ink"
                        aria-label={`Remove ${colour.name} from comparison`}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      <section className="shell pb-16 pt-10">
        <ArrowLink to="/room-preview">See any of these colours on a real wall</ArrowLink>
      </section>
    </>
  )
}
