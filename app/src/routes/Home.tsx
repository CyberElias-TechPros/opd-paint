import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Droplets,
  Leaf,
  Palette,
  Ruler,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react'
import { usePageMeta, ORGANISATION_SCHEMA } from '../lib/seo'
import { SmartImage } from '../components/media/SmartImage'
import { Reveal } from '../components/motion/Reveal'
import { ArrowLink, Badge, Kicker, Rule, SectionHead } from '../components/ui/Bits'
import { ButtonLink } from '../components/ui/Button'
import { COLORS, COLLECTIONS, FAMILIES, COLOR_LRV } from '../data/colors'
import { PALETTES } from '../data/palettes'
import { PRODUCTS } from '../data/products'
import { PROJECTS, STAGE_LABEL } from '../data/projects'
import { GUIDES } from '../data/guides'
import { DEALERS, STATES, BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL, WHATSAPP_NUMBER } from '../data/dealers'
import { ColourCard, ColourStrip } from '../components/colour/ColourCard'
import { naira } from '../lib/format'
import { cn } from '../lib/cn'
import { track } from '../lib/analytics'

/* --------------------------------------------------------------- utilities */
/**
 * Scroll parallax without a React render per frame.
 *
 * The shift is written to a CSS custom property on the tracked element and read
 * by descendants through `calc()`. A scroll-linked state update would re-render
 * the entire hero section sixty times a second, which is exactly the kind of
 * main-thread work that shows up as a poor INP on a mid-range Android phone.
 * Users who ask for reduced motion never get the listener at all.
 */
function useParallax(strength = 0.12) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const apply = () => {
      frame = 0
      const node = ref.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height)
      const shift = (Math.min(1, Math.max(0, progress)) - 0.5) * 100 * strength
      node.style.setProperty('--hero-shift', shift.toFixed(2))
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(apply)
    }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [strength])

  return ref
}

const FEATURED_COLOURS = ['lilac-room', 'palm-shadow', 'terracotta', 'atlantic-blue', 'savannah-sand', 'plum-velvet']
  .map((id) => COLORS.find((c) => c.id === id))
  .filter(Boolean)

const HOME_PROJECTS = ['arched-villa-lekki', 'lilac-lounge-lekki', 'blue-boundary', 'lagoon-facade', 'modern-cube']

export default function Home() {
  usePageMeta({
    title: "OPUDA'S PAINT — Colour, made in Nigeria",
    description:
      "Explore the OPUDA'S colour library, preview a shade on a photo of your own wall, calculate how much paint a room needs, and find a dealer. Matt and Silk emulsion, manufactured in Nigeria with a five-year guarantee.",
    path: '/',
    image: '/media/project-finished-villa.webp',
    jsonLd: [
      ORGANISATION_SCHEMA,
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'OPUDA’S PAINT',
        url: 'https://opudapaint.com',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://opudapaint.com/colours?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  })

  const heroRef = useParallax(0.16)

  return (
    <>
      {/* ================================================================= HERO */}
      <section className="relative overflow-hidden pb-10 pt-8 sm:pt-12" aria-labelledby="hero-title">
        <div className="shell grid items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-14">
          <div className="relative z-10">
            <Kicker className="mb-6">
              Manufactured in Nigeria · Matte &amp; Silk emulsions
            </Kicker>

            <h1 id="hero-title" className="display text-[clamp(2.9rem,6.6vw,5.6rem)]">
              Colour that
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 italic">holds its own</span>
                <span
                  aria-hidden
                  className="absolute inset-x-[-2%] bottom-[6%] z-0 h-[26%] -rotate-[0.8deg] bg-green/22"
                  style={{ clipPath: 'polygon(0 12%, 100% 0, 99% 88%, 1% 100%)' }}
                />
              </span>
              <br />
              in Lagos light.
            </h1>

            <p className="mt-6 max-w-lg text-[1.02rem] leading-relaxed text-ink/70">
              Our own pails, our own pigments, on our own sites. Match a colour, see it on your wall before you buy a
              bucket, and know exactly how many litres the room needs.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink to="/colours" size="lg">
                Explore {COLORS.length} colours <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink to="/room-preview" size="lg" variant="paper">
                <Sparkles className="size-4" aria-hidden /> Preview on your wall
              </ButtonLink>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-ink/12 pt-5">
              {[
                { value: '5 yr', label: 'Guarantee on Matt & Silk' },
                { value: `${COLORS.length}`, label: 'Colours in the launch library' },
                { value: `${STATES.length}`, label: 'States with a dealer' },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="tabular font-[var(--font-display)] text-[1.7rem] leading-none">{stat.value}</dt>
                  <dd className="mt-1.5 text-[0.7rem] leading-snug text-ink/60">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* layered photography */}
          <div ref={heroRef} className="relative">
            <div
              className="relative"
              style={{ transform: 'translate3d(0, calc(var(--hero-shift, 0) * 1px), 0)' }}
            >
              <Reveal variant="scale" className="overflow-hidden rounded-sm shadow-[var(--shadow-plate)]">
                <SmartImage
                  name="project-finished-villa"
                  priority
                  aspect={4 / 3}
                  sizes="(max-width: 1024px) 92vw, 46vw"
                  className="w-full"
                />
              </Reveal>

              <div
                className="absolute -left-4 bottom-6 hidden w-[13.5rem] overflow-hidden rounded-sm border border-paper-2/60 shadow-[0_30px_60px_-30px_rgba(11,26,19,0.7)] sm:block"
                style={{ transform: 'translate3d(0, calc(var(--hero-shift, 0) * -0.6px), 0)' }}
              >
                <SmartImage name="product-matt-bucket" aspect={3 / 4} sizes="220px" />
                <div className="bg-paper-2/95 px-2.5 py-2 backdrop-blur">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-green">The pail</p>
                  <p className="text-[0.74rem] font-semibold leading-tight">OPUDA&rsquo;S MATT · 20 L</p>
                </div>
              </div>

              <div
                className="absolute -right-2 top-6 w-[11.5rem] rounded-sm border border-ink/10 bg-paper-2/95 p-3 shadow-[0_24px_50px_-30px_rgba(11,26,19,0.6)] backdrop-blur sm:-right-6"
                style={{ transform: 'translate3d(0, calc(var(--hero-shift, 0) * 0.8px), 0)' }}
              >
                <p className="kicker text-ink/60">From this elevation</p>
                <div className="mt-2 flex gap-1.5">
                  {['bone', 'pebble', 'brick-lane', 'graphite'].map((id) => {
                    const colour = COLORS.find((c) => c.id === id)
                    if (!colour) return null
                    return (
                      <Link
                        key={id}
                        to={`/colours/${id}`}
                        className="group/sw relative size-8 overflow-hidden rounded-[2px] ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
                        style={{ background: colour.hex }}
                        aria-label={`${colour.name} — used on this elevation`}
                      />
                    )
                  })}
                </div>
                <Link
                  to="/inspiration/arched-villa-lekki"
                  className="mt-2.5 inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-green hover:underline"
                >
                  See the project <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* rotating seal */}
        <div className="pointer-events-none absolute right-4 top-24 hidden lg:block">
          <div className="relative size-24 animate-[spin-slow_28s_linear_infinite]">
            <svg viewBox="0 0 100 100" className="size-full">
              <defs>
                <path id="sealPath" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
              </defs>
              <text className="fill-ink/40 text-[7.4px] font-bold uppercase tracking-[0.28em]">
                <textPath href="#sealPath">Made in Nigeria · 5-year guarantee · </textPath>
              </text>
            </svg>
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <ShieldCheck className="size-6 text-green/70" aria-hidden />
          </div>
        </div>
      </section>

      {/* ============================================================ RIBBON */}
      <section aria-label="Colour families" className="border-y border-ink/10 bg-paper-2/50 py-3">
        <div className="relative flex overflow-hidden">
          <div className="marquee-track flex min-w-full shrink-0 items-center gap-8 pr-8">
            {[...FAMILIES, ...FAMILIES].map((family, index) => (
              <Link
                key={`${family}-${index}`}
                to={`/colours?family=${encodeURIComponent(family)}`}
                className="flex shrink-0 items-center gap-2.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-ink/60 transition-colors hover:text-ink"
              >
                <span className="flex">
                  {COLORS.filter((c) => c.family === family)
                    .slice(0, 4)
                    .map((c) => (
                      <span
                        key={c.id}
                        className="-ml-1 size-3.5 rounded-full ring-1 ring-paper first:ml-0"
                        style={{ background: c.hex }}
                      />
                    ))}
                </span>
                {family}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= THREE WAYS IN */}
      <section className="shell py-16 sm:py-24" aria-labelledby="pathways-title">
        <SectionHead
          kicker="Start here"
          title={
            <span id="pathways-title">
              Three ways to go from
              <br />
              <span className="italic">a feeling to a finished wall.</span>
            </span>
          }
          lede="Whether you already have a colour in mind or a bare room and a bucket, one of these gets you to a decision you can hand to a painter."
          action={<ArrowLink to="/advice">All advice</ArrowLink>}
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              n: '01',
              title: 'Find the colour',
              body: 'Filter the launch library by family, undertone, room and light reflectance. Compare side by side, then save them to a project.',
              to: '/colours',
              cta: 'Colour library',
              icon: Palette,
              image: 'interior-lilac-lounge',
            },
            {
              n: '02',
              title: 'See it on your wall',
              body: 'Upload a photograph of your room. Select the wall, apply a colour, and compare before and after — all inside your browser.',
              to: '/room-preview',
              cta: 'Room preview',
              icon: Sparkles,
              image: 'interior-mauve-peach',
            },
            {
              n: '03',
              title: 'Size the job',
              body: 'Enter the room, deduct the doors and windows, and get the exact pack combination to buy — with the arithmetic shown.',
              to: '/calculator',
              cta: 'Paint calculator',
              icon: Ruler,
              image: 'project-render-stage',
            },
          ].map((card, index) => (
            <Reveal key={card.n} delay={index * 90}>
              <Link
                to={card.to}
                onClick={() => track('cta_click', { target: `home-pathway-${card.n}` })}
                className="group flex h-full flex-col overflow-hidden rounded-sm border border-ink/12 bg-paper-2/60 transition-all duration-500 hover:-translate-y-1 hover:border-ink/25 hover:shadow-[0_30px_60px_-40px_rgba(11,26,19,0.5)]"
              >
                <div className="relative">
                  <SmartImage
                    name={card.image}
                    aspect={16 / 10}
                    sizes="(max-width: 768px) 92vw, 30vw"
                    imgClassName="transition-transform duration-[1.2s] ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
                    overlay="bg-gradient-to-t from-ink/45 via-transparent to-transparent"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-paper-2/90 px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.12em] text-ink">
                    {card.n}
                  </span>
                  <card.icon className="absolute bottom-3 right-3 size-5 text-paper-2/90" aria-hidden />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-[var(--font-display)] text-[1.35rem] leading-tight">{card.title}</h3>
                  <p className="mt-2 flex-1 text-[0.85rem] leading-relaxed text-ink/60">{card.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.13em] text-green">
                    {card.cta}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ========================================================= PALETTES */}
      <section className="relative overflow-hidden bg-ink py-16 text-paper-2 sm:py-24" aria-labelledby="palettes-title">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 0%, rgba(18,150,95,0.5), transparent 45%), radial-gradient(circle at 0% 90%, rgba(223,174,82,0.35), transparent 40%)',
          }}
        />
        <div className="shell relative">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <Kicker className="mb-4 text-paper-2/65">Curated, not generated</Kicker>
              <h2 id="palettes-title" className="display text-[clamp(1.9rem,3.8vw,3.1rem)]">
                Palettes with <span className="italic text-gold">a reason</span> behind every colour.
              </h2>
              <p className="mt-4 max-w-lg text-[0.95rem] leading-relaxed text-paper-2/60">
                Each palette names its lead colour, the supporting walls and the trim, and says which room it was built
                for. No random harmony wheels.
              </p>
            </div>
            <ArrowLink to="/colours?view=palettes" className="text-paper-2">
              All {PALETTES.length} palettes
            </ArrowLink>
          </div>

          <ul className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {PALETTES.slice(0, 6).map((palette, index) => (
              <li key={palette.id} className="w-[19rem] shrink-0 snap-start sm:w-[21rem]">
                <Reveal delay={index * 60}>
                  <Link
                    to={`/colours?palette=${palette.id}`}
                    className="group block overflow-hidden rounded-sm border border-paper-2/15 bg-paper-2/[0.04] transition-colors hover:border-paper-2/40"
                  >
                    <div className="relative">
                      <SmartImage
                        name={palette.image}
                        aspect={4 / 3}
                        sizes="340px"
                        imgClassName="transition-transform duration-[1.2s] group-hover:scale-[1.05]"
                      />
                      <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-paper-2/90 backdrop-blur">
                        {palette.season}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-[var(--font-display)] text-[1.25rem]">{palette.name}</h3>
                        <span className="text-[0.62rem] text-paper-2/65">{palette.colors.length} colours</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[0.8rem] leading-relaxed text-paper-2/70">{palette.story}</p>
                      <div className="mt-3 flex h-8 overflow-hidden rounded-[2px]">
                        {palette.colors.map((id) => {
                          const colour = COLORS.find((c) => c.id === id)
                          return colour ? (
                            <span key={id} className="flex-1" style={{ background: colour.hex }} title={colour.name} />
                          ) : null
                        })}
                      </div>
                    </div>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ==================================================== COLOUR FEATURE */}
      <section className="shell py-16 sm:py-24" aria-labelledby="feature-colour">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <Kicker className="mb-4">Our pick this season</Kicker>
            <h2 id="feature-colour" className="display text-[clamp(1.9rem,3.8vw,3.1rem)]">
              Lilac Room, <span className="italic">OP-605</span>
            </h2>
            <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-ink/70">
              Taken from a finished lounge in Lekki Phase 1. Soft enough to take a whole room, unusual enough that guests
              ask for the code. It reads warm under lamp light and distinctly cool in the morning — which is exactly
              why we photographed it in both.
            </p>
            <dl className="mt-6 grid max-w-sm grid-cols-2 gap-x-6 gap-y-3">
              {[
                { k: 'Code', v: 'OP-605' },
                { k: 'LRV ≈', v: String(COLOR_LRV(COLORS.find((c) => c.id === 'lilac-room')!)) },
                { k: 'Family', v: 'Purple & Mauve' },
                { k: 'Undertone', v: 'Cool' },
              ].map((row) => (
                <div key={row.k} className="border-t border-ink/12 pt-2">
                  <dt className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink/60">{row.k}</dt>
                  <dd className="mt-0.5 text-[0.9rem] font-semibold">{row.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to="/colours/lilac-room">Open the colour</ButtonLink>
              <ButtonLink to="/room-preview?colour=lilac-room" variant="outline">
                Preview it on a wall
              </ButtonLink>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Reveal variant="scale" className="overflow-hidden rounded-sm">
              <SmartImage name="interior-lilac-lounge" aspect={3 / 4} sizes="(max-width: 768px) 46vw, 28vw" />
            </Reveal>
            <div className="grid gap-3">
              <Reveal variant="scale" delay={80} className="overflow-hidden rounded-sm">
                <SmartImage name="interior-mauve-peach" aspect={3 / 4} sizes="(max-width: 768px) 46vw, 28vw" />
              </Reveal>
              <div className="rounded-sm border border-ink/12 bg-paper-2/70 p-3">
                <p className="text-[0.64rem] font-bold uppercase tracking-[0.14em] text-ink/60">The palette</p>
                <div className="mt-2 h-10 overflow-hidden rounded-[2px]">
                  <ColourStrip hexes={['#D1BFD5', '#8C6D85', '#F8F5EE', '#A8A69C']} className="h-full rounded-none" />
                </div>
                <p className="mt-2 text-[0.7rem] leading-snug text-ink/60">
                  Lilac Room · Dusty Grape · Opuda White · Pebble
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================== PRODUCTS */}
      <section className="border-y border-ink/10 bg-plaster/40 py-16 sm:py-24" aria-labelledby="range-title">
        <div className="shell">
          <SectionHead
            kicker="The range"
            title={<span id="range-title">Four systems, one colour library.</span>}
            lede="The same tint can be mixed into different products. Choose the finish by where the wall is and how it will be cleaned — not by price alone."
            action={<ArrowLink to="/products">All products &amp; data sheets</ArrowLink>}
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCTS.filter((p) => ['matt', 'silk', 'gloss', 'weathershield'].includes(p.id)).map((product, index) => {
              const from = product.packs.filter((p) => p.guidePrice).map((p) => p.guidePrice as number)
              return (
                <Reveal key={product.id} delay={index * 70}>
                  <Link
                    to={`/products/${product.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-sm border border-ink/12 bg-paper-2 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-40px_rgba(11,26,19,0.45)]"
                  >
                    <SmartImage
                      name={product.image}
                      aspect={1}
                      sizes="(max-width: 640px) 92vw, 24vw"
                      imgClassName="transition-transform duration-[1.2s] group-hover:scale-[1.05]"
                    />
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="kicker text-green">{product.finish}</span>
                        <Badge tone={product.claimsStatus === 'label-verified' ? 'green' : 'line'}>
                          {product.claimsStatus === 'label-verified' ? 'Label verified' : 'Spec pending'}
                        </Badge>
                      </div>
                      <h3 className="mt-2 font-[var(--font-display)] text-[1.25rem] leading-tight">{product.shortName}</h3>
                      <p className="mt-1.5 line-clamp-2 flex-1 text-[0.8rem] leading-relaxed text-ink/60">{product.tagline}</p>
                      <div className="mt-3 flex items-end justify-between border-t border-ink/10 pt-2.5">
                        <span className="text-[0.72rem] text-ink/60">
                          From <span className="font-semibold text-ink">{from.length ? naira(Math.min(...from)) : 'on request'}</span>
                        </span>
                        <span className="text-[0.66rem] text-ink/60">guide</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ==================================================== ROOM PREVIEW CTA */}
      <section className="shell py-16 sm:py-24" aria-labelledby="preview-title">
        <div className="overflow-hidden rounded-sm bg-ink text-paper-2">
          <div className="grid items-stretch lg:grid-cols-2">
            <div className="relative min-h-[20rem]">
              <SmartImage
                name="interior-mauve-peach"
                aspect={4 / 3}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="absolute inset-0 size-full"
                imgClassName="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent lg:bg-gradient-to-r" />
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-paper-2/90 px-3 py-1.5 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink">
                <Sun className="size-3.5" aria-hidden /> Same room, sixty colours
              </div>
            </div>
            <div className="flex flex-col justify-center gap-5 p-7 sm:p-10">
              <Kicker className="text-paper-2/65">Room preview</Kicker>
              <h2 id="preview-title" className="display text-[clamp(1.8rem,3.4vw,2.7rem)]">
                Paint your own wall — <span className="italic">before you buy the bucket.</span>
              </h2>
              <p className="max-w-md text-[0.95rem] leading-relaxed text-paper-2/65">
                Upload a photograph, tap the wall, and try any colour in the library. The preview keeps the light and
                shadows in your photo, and switches between matt and silk so you can see the difference a finish makes.
              </p>
              <ul className="space-y-2 text-[0.85rem] text-paper-2/70">
                {[
                  { icon: Droplets, text: 'Magic fill plus a brush for the awkward edges' },
                  { icon: ShieldCheck, text: 'Your photo is processed in the browser and never uploaded' },
                  { icon: Sparkles, text: 'Download a preview to show your painter' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2.5">
                    <item.icon className="mt-0.5 size-4 shrink-0 text-green-bright" aria-hidden />
                    {item.text}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 pt-1">
                <ButtonLink to="/room-preview" variant="paper" size="lg">
                  Open room preview <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                <ButtonLink
                  to="/advice/colour-on-screen"
                  variant="outline"
                  size="lg"
                  className="border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
                >
                  Why screens differ
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================== PROJECTS */}
      <section className="shell pb-16 sm:pb-24" aria-labelledby="projects-title">
        <SectionHead
          kicker="Site record"
          title={<span id="projects-title">Our photography, not a stock library.</span>}
          lede="Every frame below is an OPUDA’S site, supplied by the company. The palettes and products listed on each project are the ones that were actually used."
          action={<ArrowLink to="/inspiration">All projects</ArrowLink>}
        />

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          {HOME_PROJECTS.map((id, index) => {
            const project = PROJECTS.find((p) => p.id === id)
            if (!project) return null
            const large = index === 0
            return (
              <Reveal
                key={id}
                delay={index * 60}
                className={cn(large && 'sm:col-span-2 lg:row-span-2')}
              >
                <Link
                  to={`/inspiration/${project.id}`}
                  className="group relative block h-full overflow-hidden rounded-sm"
                >
                  <SmartImage
                    name={project.cover}
                    aspect={large ? 4 / 3 : 3 / 4}
                    sizes={large ? '(max-width: 640px) 92vw, 46vw' : '(max-width: 640px) 92vw, 23vw'}
                    imgClassName="transition-transform duration-[1.4s] ease-[var(--ease-out-quint)] group-hover:scale-[1.05]"
                    overlay="bg-gradient-to-t from-ink/80 via-ink/10 to-transparent"
                    className="h-full"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-paper-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="paper">{STAGE_LABEL[project.stage]}</Badge>
                      <span className="text-[0.66rem] uppercase tracking-[0.12em] text-paper-2/60">{project.kind}</span>
                    </div>
                    <h3 className={cn('mt-2 font-[var(--font-display)] leading-tight', large ? 'text-[1.6rem]' : 'text-[1.1rem]')}>
                      {project.title}
                    </h3>
                    <p className="mt-0.5 text-[0.72rem] text-paper-2/65">{project.location}</p>
                    <div className="mt-2.5 flex gap-1">
                      {project.colorIds.slice(0, 5).map((colourId) => {
                        const colour = COLORS.find((c) => c.id === colourId)
                        return colour ? (
                          <span
                            key={colourId}
                            className="size-4 rounded-[2px] ring-1 ring-inset ring-white/25"
                            style={{ background: colour.hex }}
                            title={colour.name}
                          />
                        ) : null
                      })}
                    </div>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ======================================================== CALCULATOR */}
      <section className="border-y border-ink/10 bg-green-deep py-14 text-paper-2 sm:py-20" aria-labelledby="calc-title">
        <div className="shell grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <Kicker className="mb-4 text-paper-2/65">Stop guessing</Kicker>
            <h2 id="calc-title" className="display text-[clamp(1.9rem,3.6vw,2.9rem)]">
              How much paint does a 4.2 × 3.6 m room need?
            </h2>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-paper-2/65">
              Two coats over 45 m² of wall, with a door and two windows deducted and an 8% trim allowance, comes to
              roughly 9 litres. The calculator rounds that up to real pack sizes, shows the arithmetic, and tells you
              what you will have left over.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/calculator" variant="paper" size="lg">
                Open the calculator
              </ButtonLink>
              <ButtonLink
                to="/advice/how-much-paint"
                variant="outline"
                size="lg"
                className="border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
              >
                The maths behind it
              </ButtonLink>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4">
            {[
              { k: 'Coverage', v: '11 m²/L', d: 'Matt, per coat, sealed wall' },
              { k: 'Recoat', v: '3 hrs', d: 'Matt at 25°C, 60% RH' },
              { k: 'Guarantee', v: '5 years', d: 'Matt & Silk, label terms' },
              { k: 'Handling', v: '+5%', d: 'Roller loss and touch-ups' },
            ].map((item) => (
              <div key={item.k} className="rounded-sm border border-paper-2/15 bg-paper-2/[0.04] p-3.5">
                <dt className="text-[0.64rem] font-bold uppercase tracking-[0.14em] text-paper-2/65">{item.k}</dt>
                <dd className="mt-1 font-[var(--font-display)] text-[1.4rem] leading-none">{item.v}</dd>
                <dd className="mt-1 text-[0.68rem] leading-snug text-paper-2/65">{item.d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============================================================ ADVICE */}
      <section className="shell py-16 sm:py-24" aria-labelledby="advice-title">
        <SectionHead
          kicker="Practical advice"
          title={<span id="advice-title">Written for the weather you actually paint in.</span>}
          lede="Humidity, cement render, harmattan dust and salt air. These guides assume a Nigerian site, not a European brochure."
          action={<ArrowLink to="/advice">All guides</ArrowLink>}
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {GUIDES.slice(0, 3).map((guide, index) => (
            <Reveal key={guide.id} delay={index * 80}>
              <Link
                to={`/advice/${guide.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-sm border border-ink/12 bg-paper-2/50 transition-all duration-500 hover:-translate-y-1 hover:bg-paper-2 hover:shadow-[0_30px_60px_-40px_rgba(11,26,19,0.4)]"
              >
                <SmartImage
                  name={guide.hero}
                  aspect={16 / 10}
                  sizes="(max-width: 768px) 92vw, 30vw"
                  imgClassName="transition-transform duration-[1.2s] group-hover:scale-[1.04]"
                />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink/60">
                    <span className="text-green">{guide.category}</span>
                    <span aria-hidden>·</span>
                    <span>{guide.readMinutes} min</span>
                  </div>
                  <h3 className="mt-2 font-[var(--font-display)] text-[1.2rem] leading-snug">{guide.title}</h3>
                  <p className="mt-2 flex-1 line-clamp-2 text-[0.82rem] leading-relaxed text-ink/60">{guide.summary}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-green">
                    Read <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* =========================================================== DEALERS */}
      <section className="shell pb-16 sm:pb-24" aria-labelledby="dealers-title">
        <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <Kicker className="mb-3">Where to buy</Kicker>
              <h2 id="dealers-title" className="display text-[clamp(1.6rem,3vw,2.3rem)]">
                {DEALERS.length} counters, {STATES.length} states, one phone number.
              </h2>
              <p className="mt-3 max-w-xl text-[0.9rem] leading-relaxed text-ink/60">
                Brand trade counters and authorised dealers stock the full range. Call ahead to confirm the pack size and
                the colour you need — we would rather you arrived certain.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <ButtonLink to="/dealers">Find a dealer</ButtonLink>
                <a
                  href={`tel:${BRAND_PHONE_TEL}`}
                  className="inline-flex items-center gap-2 rounded-[3px] border border-ink/20 px-4 py-3 text-[0.82rem] font-semibold transition-colors hover:border-ink"
                >
                  {BRAND_PHONE_DISPLAY}
                </a>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-green hover:underline"
                >
                  WhatsApp
                </a>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.8rem] text-ink/60 sm:grid-cols-3">
              {STATES.map((state) => (
                <li key={state} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-1 rounded-full bg-green" /> {state}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ======================================================== COLOUR WALL */}
      <section className="shell pb-20" aria-labelledby="explore-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Kicker className="mb-3">The library</Kicker>
            <h2 id="explore-title" className="display text-[clamp(1.7rem,3.2vw,2.5rem)]">
              Six of sixty. The rest are in the library.
            </h2>
          </div>
          <ArrowLink to="/colours">Open the colour library</ArrowLink>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FEATURED_COLOURS.map((colour, index) =>
            colour ? (
              <Reveal key={colour.id} delay={index * 50}>
                <ColourCard colour={colour} height="regular" />
              </Reveal>
            ) : null,
          )}
        </div>
        <Rule className="mt-12" />
        <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {COLLECTIONS.map((collection) => (
              <Link
                key={collection}
                to={`/colours?collection=${encodeURIComponent(collection)}`}
                className="rounded-full border border-ink/15 px-3.5 py-1.5 text-[0.72rem] font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-paper-2"
              >
                {collection}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[0.72rem] text-ink/60">
            <BadgeCheck className="size-3.5 text-green" aria-hidden />
            Every colour has a permanent code and an estimated LRV
          </div>
        </div>
      </section>

      {/* =========================================================== FINAL CTA */}
      <section className="relative overflow-hidden bg-crimson/95 py-14 text-white sm:py-20" aria-labelledby="cta-title">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.5), transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(11,26,19,0.6), transparent 50%)',
          }}
        />
        <div className="shell relative grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="kicker mb-4 flex items-center gap-2 text-white/70">
              <Leaf className="size-3.5" aria-hidden /> Colour consultation
            </p>
            <h2 id="cta-title" className="display text-[clamp(1.9rem,3.8vw,3rem)]">
              Send us the room. We will send back a scheme.
            </h2>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-white/80">
              Photographs of the space, the light it gets, and how you want it to feel. Our colour desk replies with two
              or three options and the litres you will need — normally within one working day.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <ButtonLink to="/quote" variant="paper" size="lg" fullWidth>
              Request a consultation <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink
              to={`https://wa.me/${WHATSAPP_NUMBER}`}
              external
              size="lg"
              fullWidth
              className="border border-white/40 bg-transparent text-white hover:bg-white hover:text-crimson"
            >
              WhatsApp the colour desk
            </ButtonLink>
            <p className="text-center text-[0.7rem] text-white/60">
              Or call {BRAND_PHONE_DISPLAY} — Monday to Saturday, 8am to 6pm.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
