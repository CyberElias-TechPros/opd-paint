import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookmarkCheck, Copy, Eye, Info } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { COLORS, COLOR_LRV, findColor, type PaintColor } from '../data/colors'
import { PALETTES } from '../data/palettes'
import { PRODUCTS } from '../data/products'
import { PROJECTS } from '../data/projects'
import { SmartImage } from '../components/media/SmartImage'
import { Badge, Kicker, ArrowLink, DataRow } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { ColourCard } from '../components/colour/ColourCard'
import { useApp } from '../store/AppStore'
import { contrast, deltaE, harmony, swatchText } from '../lib/color'
import { track } from '../lib/analytics'
import { WHATSAPP_NUMBER } from '../data/dealers'
import NotFound from './NotFound'

export default function ColourDetail() {
  const { id = '' } = useParams()
  const colour = findColor(id)
  const { isSaved, toggleColor, pushRecent, toast } = useApp()

  useEffect(() => {
    if (colour) {
      pushRecent(colour.id)
      track('colour_view', { colourId: colour.id, surface: 'detail' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colour?.id])

  const related = useMemo(() => {
    if (!colour) return []
    return COLORS.filter((c) => c.id !== colour.id)
      .map((c) => ({ colour: c, distance: deltaE(colour.hex, c.hex) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4)
      .map((entry) => entry.colour)
  }, [colour])

  const pairs = useMemo(() => {
    if (!colour) return null
    return harmony(colour.hex)
  }, [colour])

  const curatedPairings = useMemo(() => {
    if (!colour) return []
    const palettes = PALETTES.filter((p) => p.colors.includes(colour.id))
    const ids = new Set<string>()
    palettes.forEach((p) => p.colors.forEach((c) => c !== colour.id && ids.add(c)))
    return [...ids].map((cid) => COLORS.find((c) => c.id === cid)).filter(Boolean).slice(0, 6) as PaintColor[]
  }, [colour])

  const projects = useMemo(
    () => (colour ? PROJECTS.filter((p) => p.colorIds.includes(colour.id)) : []),
    [colour],
  )

  usePageMeta({
    title: colour ? `${colour.name} (${colour.code})` : 'Colour not found',
    description: colour
      ? `${colour.name}, code ${colour.code} — a ${colour.undertone.toLowerCase()} ${colour.family.toLowerCase()} from the OPUDA'S PAINT library with an estimated LRV of ${COLOR_LRV(colour)}. See it on a wall, match compatible products and save it to your project.`
      : 'This colour could not be found.',
    path: `/colours/${id}`,
    image: colour ? `/media/${PROJECTS.find((p) => p.colorIds.includes(colour.id))?.cover ?? 'interior-lilac-lounge'}.webp` : undefined,
    noIndex: !colour,
    jsonLd: colour
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: `${colour.name} — ${colour.code}`,
          sku: colour.code,
          category: `Paint colour · ${colour.family}`,
          brand: { '@type': 'Brand', name: 'OPUDA’S PAINT' },
          color: colour.hex,
          description: colour.note,
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'NGN',
            lowPrice: 6200,
            highPrice: 132000,
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: 'OPUDA’S PAINT' },
          },
        }
      : undefined,
  })

  if (!colour) return <NotFound />

  const saved = isSaved(colour.id)
  const swatch = swatchText(colour.hex)
  const index = COLORS.findIndex((c) => c.id === colour.id)
  const prev = COLORS[(index - 1 + COLORS.length) % COLORS.length]
  const next = COLORS[(index + 1) % COLORS.length]
  const contrastWithPaper = contrast(colour.hex, '#f7f2e9')

  const copy = async () => {
    const text = `${colour.name} — ${colour.code} — ${colour.hex} · OPUDA'S PAINT colour library`
    try {
      await navigator.clipboard.writeText(text)
      toast('Colour details copied', { description: text })
    } catch {
      window.prompt('Copy this colour reference:', text)
    }
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="shell pt-6">
        <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] text-ink/72">
          <li>
            <Link to="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/colours" className="hover:text-ink">
              Colours
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to={`/colours?family=${encodeURIComponent(colour.family)}`} className="hover:text-ink">
              {colour.family}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-ink/70">
            {colour.name}
          </li>
        </ol>
      </nav>

      <section className="shell grid gap-8 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:py-12">
        {/* ------------------------------------------------------------ swatch */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div
            className="relative overflow-hidden rounded-sm ring-1 ring-inset ring-black/10"
            style={{ background: colour.hex, aspectRatio: '4 / 3.4' }}
          >
            {/*
              Small type sits on a paper plate, never on bare paint: on seven of
              the mid-tone colours neither ink nor paper text reaches 4.5:1
              directly (see `swatchText` in lib/color.ts). The colour name is
              large enough to qualify at 3:1, so it stays on the swatch itself
              using whichever text colour measures better.
            */}
            <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="rounded-full bg-paper-2/95 px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-ink">
                  {colour.code}
                </span>
                <span className="rounded-full bg-paper-2/95 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-ink">
                  {colour.collection}
                </span>
              </div>
              <div>
                <p
                  className="font-[var(--font-display)] text-[clamp(2rem,4vw,3.2rem)] leading-[0.95]"
                  style={{ color: swatch.text }}
                >
                  {colour.name}
                </p>
                <p
                  className="mt-3 inline-block rounded-full bg-paper-2/95 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink"
                >
                  {colour.family} · {colour.undertone}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => toggleColor(colour.id)} aria-pressed={saved} variant={saved ? 'paper' : 'solid'}>
              {saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
              {saved ? 'In your project' : 'Save to project'}
            </Button>
            <ButtonLink to={`/room-preview?colour=${colour.id}`} variant="outline">
              <Eye className="size-4" aria-hidden /> Preview on a wall
            </ButtonLink>
            <Button variant="ghost" onClick={copy} aria-label="Copy colour details">
              <Copy className="size-4" aria-hidden /> Copy
            </Button>
          </div>

          <div className="mt-6 rounded-sm border border-ink/12 bg-paper-2/60 p-4">
            <p className="flex items-start gap-2 text-[0.76rem] leading-relaxed text-ink/72">
              <Info className="mt-0.5 size-4 shrink-0 text-ink/72" aria-hidden />
              Colour on a screen is a digital approximation. Lighting, finish and substrate change how a real film
              reads. Order a sample pot or ask a dealer for a chip before committing to a room.
            </p>
            <div className="mt-3 flex gap-2">
              <ButtonLink to="/quote?type=sample" size="sm" variant="paper">
                Request a sample
              </ButtonLink>
              <ButtonLink to="/dealers" size="sm" variant="ghost">
                Find a dealer
              </ButtonLink>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- facts */}
        <div>
          <Kicker className="mb-3">Colour record</Kicker>
          <h1 className="display text-[clamp(2.2rem,4.4vw,3.4rem)]">
            {colour.name}
            <span className="ml-3 align-middle text-[0.9rem] font-sans font-semibold tracking-[0.14em] text-ink/72">
              {colour.code}
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-ink/70">{colour.note}</p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6">
            <DataRow label="Hex value" value={<span className="tabular uppercase">{colour.hex}</span>} />
            <DataRow label="Family" value={colour.family} />
            <DataRow label="Undertone" value={colour.undertone} />
            <DataRow label="Collection" value={colour.collection} />
            <DataRow label="LRV ≈" value={`${COLOR_LRV(colour)} / 100`} />
            <DataRow label="Best rooms" value={colour.rooms.slice(0, 3).join(', ')} />
            <DataRow
              label="Contrast on paper"
              value={
                <span className="flex items-center gap-1.5">
                  {contrastWithPaper.toFixed(1)}:1
                  <Badge tone={contrastWithPaper >= 4.5 ? 'green' : 'line'}>
                    {contrastWithPaper >= 4.5 ? 'Text safe' : 'Decorative'}
                  </Badge>
                </span>
              }
            />
            <DataRow label="Digital source" value="Fan deck proof" />
          </dl>

          <div className="mt-6 rounded-sm border border-ink/12 bg-paper-2/50 p-4">
            <p className="text-[0.72rem] leading-relaxed text-ink/72">
              <span className="font-semibold text-ink">Reading the LRV.</span> Light reflectance value describes how
              much light a colour bounces back. 0 is absolute black, 100 is absolute white. Values under 25 absorb most
              light and need good lighting; values above 75 are bright enough for ceilings and small rooms. The number
              here is estimated from the digital value — a laboratory reading of a dried film is the figure a specifier
              should use.
            </p>
          </div>

          {/* pairings */}
          <section className="mt-10" aria-labelledby="pairings-title">
            <h2 id="pairings-title" className="text-[1.15rem] font-semibold">
              Pairs with
            </h2>
            <p className="mt-1 text-[0.8rem] text-ink/72">
              Curated pairings from our palettes first, then computed complements.
            </p>
            {(curatedPairings.length ? curatedPairings : related).length ? (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {(curatedPairings.length ? curatedPairings : related).map((pair) => (
                  <ColourCard key={pair.id} colour={pair} height="compact" showMeta />
                ))}
              </div>
            ) : null}

            {pairs ? (
              <div className="mt-5 space-y-2">
                {[
                  { label: 'Complementary', hexes: pairs.complementary },
                  { label: 'Analogous', hexes: pairs.analogous },
                  { label: 'Triadic', hexes: pairs.triadic },
                ].map((group) => (
                  <div key={group.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink/72">
                      {group.label}
                    </span>
                    <div className="flex flex-1 gap-1.5">
                      {group.hexes.map((hex) => (
                        <span
                          key={hex}
                          className="h-8 flex-1 rounded-[2px] ring-1 ring-inset ring-black/10"
                          style={{ background: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-[0.7rem] text-ink/72">
                  Computed in CIE space for preference, not a substitute for a designer’s eye.
                </p>
              </div>
            ) : null}
          </section>

          {/* products */}
          <section className="mt-10" aria-labelledby="products-title">
            <h2 id="products-title" className="text-[1.15rem] font-semibold">
              Mixed in these products
            </h2>
            <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
                {PRODUCTS.filter((p) => p.finish !== 'Filler').map((product) => {
                return (
                  <li key={product.id}>
                    <Link to={`/products/${product.id}`} className="group flex items-center justify-between gap-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-[0.88rem] font-semibold group-hover:text-green">{product.name}</span>
                        <span className="block text-[0.72rem] text-ink/72">
                          {product.finish} · {product.coveragePerUnit} m² per litre per coat
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-ink/40 transition-transform group-hover:translate-x-1 group-hover:text-green" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* on site */}
          {projects.length ? (
            <section className="mt-10" aria-labelledby="onsite-title">
              <h2 id="onsite-title" className="text-[1.15rem] font-semibold">
                On our sites
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {projects.slice(0, 2).map((project) => (
                  <Link key={project.id} to={`/inspiration/${project.id}`} className="group overflow-hidden rounded-sm">
                    <SmartImage
                      name={project.cover}
                      aspect={4 / 3}
                      sizes="(max-width: 640px) 92vw, 30vw"
                      imgClassName="transition-transform duration-[1.2s] group-hover:scale-105"
                      overlay="bg-gradient-to-t from-ink/70 to-transparent"
                    />
                    <div className="-mt-16 relative p-4 text-paper-2">
                      <p className="text-[0.62rem] uppercase tracking-[0.14em] text-paper-2/70">{project.kind}</p>
                      <p className="text-[0.95rem] font-semibold">{project.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* neighbours */}
          <nav className="mt-10 flex items-center justify-between gap-4 border-t border-ink/12 pt-4" aria-label="Colour pagination">
            <Link to={`/colours/${prev.id}`} className="group flex items-center gap-2 text-[0.78rem] hover:text-green">
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
              <span className="flex items-center gap-2">
                <span className="size-5 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: prev.hex }} aria-hidden />
                {prev.name}
              </span>
            </Link>
            <Link to={`/colours/${next.id}`} className="group flex items-center gap-2 text-[0.78rem] hover:text-green">
              <span className="flex items-center gap-2">
                {next.name}
                <span className="size-5 rounded-[2px] ring-1 ring-inset ring-black/10" style={{ background: next.hex }} aria-hidden />
              </span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </nav>
        </div>
      </section>

      <section className="shell pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-ink/12 bg-paper-2/60 px-5 py-4">
          <div>
            <p className="text-[0.92rem] font-semibold">Need it in a specific finish?</p>
            <p className="text-[0.8rem] text-ink/72">
              {colour.name} can be mixed in Matt, Silk or Weathershield. Tell us the room and we will recommend one.
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink
              to={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello OPUDA'S PAINT, I'm interested in ${colour.name} (${colour.code}).`)}`}
              external
              size="sm"
            >
              WhatsApp <ArrowUpRight className="size-3.5" aria-hidden />
            </ButtonLink>
            <ButtonLink to={`/quote?colour=${colour.id}`} size="sm" variant="outline">
              Ask the colour desk
            </ButtonLink>
          </div>
        </div>
        <div className="mt-8">
          <ArrowLink to="/colours">Back to the full library</ArrowLink>
        </div>
      </section>
    </>
  )
}
