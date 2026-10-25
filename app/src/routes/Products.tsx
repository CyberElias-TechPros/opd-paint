import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Droplet, Layers, ShieldCheck, Timer } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { PRODUCTS, FINISH_SHEEN_LABEL, type Finish, type Surface } from '../data/products'
import { SmartImage } from '../components/media/SmartImage'
import { Badge, Kicker, SectionHead, ArrowLink } from '../components/ui/Bits'
import { Reveal } from '../components/motion/Reveal'
import { Pill } from '../components/ui/Bits'
import { naira, number } from '../lib/format'

const FINISHES: Array<Finish | 'All'> = ['All', 'Matt', 'Silk', 'Primer', 'Gloss', 'Texture', 'Filler']
const SURFACES: Array<Surface | 'All'> = ['All', 'Interior walls', 'Ceilings', 'Exterior walls', 'Wood & metal', 'New plaster', 'Bathrooms & kitchens']

export default function Products() {
  const [finish, setFinish] = useState<Finish | 'All'>('All')
  const [surface, setSurface] = useState<Surface | 'All'>('All')

  const list = useMemo(
    () =>
      PRODUCTS.filter((product) => {
        if (finish !== 'All' && product.finish !== finish) return false
        if (surface !== 'All' && !product.surfaces.includes(surface)) return false
        return true
      }),
    [finish, surface],
  )

  usePageMeta({
    title: 'Products & technical data',
    description:
      'The OPUDA’S PAINT range: Matt and Silk emulsions, alkali-resisting primer, synthetic gloss, weather-resistant exterior coating and screeding compound. Coverage, drying times, pack sizes and data sheets.',
    path: '/products',
    image: '/media/product-matt-bucket.webp',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'OPUDA’S PAINT product range',
      itemListElement: PRODUCTS.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.name,
        url: `https://opudapaint.com/products/${product.id}`,
      })),
    },
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">The range</Kicker>
          <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
            <div>
              <h1 className="display text-[clamp(2.4rem,5vw,4rem)]">
                The right paint for <span className="italic">the wall you have.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink/65">
                One colour library, several systems. Matt and Silk for interiors, Weathershield for anything that faces
                the rain, Gloss for joinery and steel, plus the primer and screeding that make all of it last.
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-3">
              {[
                { icon: ShieldCheck, k: 'Guarantee', v: '5 yr' },
                { icon: Droplet, k: 'Max coverage', v: '13 m²/L' },
                { icon: Timer, k: 'Recoat', v: '3 hrs' },
              ].map((item) => (
                <div key={item.k} className="rounded-sm border border-ink/12 bg-paper-2/70 p-3">
                  <item.icon className="size-4 text-green" aria-hidden />
                  <dt className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-ink/60">{item.k}</dt>
                  <dd className="font-[var(--font-display)] text-[1.15rem] leading-none">{item.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      <div className="shell py-8">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-2" role="group" aria-label="Filter by finish">
          {FINISHES.map((option) => (
            <Pill key={option} active={finish === option} onClick={() => setFinish(option)}>
              {option}
            </Pill>
          ))}
        </div>
        <div className="no-scrollbar mt-1 flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by surface">
          {SURFACES.map((option) => (
            <Pill key={option} active={surface === option} onClick={() => setSurface(option)}>
              {option}
            </Pill>
          ))}
        </div>

        <p className="mt-4 text-[0.82rem] text-ink/60" aria-live="polite">
          {list.length} product{list.length === 1 ? '' : 's'}
        </p>

        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((product, index) => {
            const from = product.packs.filter((p) => p.guidePrice).map((p) => p.guidePrice as number)
            return (
              <li key={product.id}>
                <Reveal delay={index * 60}>
                  <article className="group flex h-full flex-col overflow-hidden rounded-sm border border-ink/12 bg-paper-2 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_36px_70px_-46px_rgba(11,26,19,0.5)]">
                    <Link to={`/products/${product.id}`} className="relative block overflow-hidden">
                      <SmartImage
                        name={product.image}
                        aspect={4 / 3}
                        sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 30vw"
                        imgClassName="transition-transform duration-[1.3s] ease-[var(--ease-out-quint)] group-hover:scale-[1.05]"
                      />
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        <Badge tone="ink">{product.finish}</Badge>
                        {product.guaranteeYears ? <Badge tone="gold">{product.guaranteeYears}-yr guarantee</Badge> : null}
                      </div>
                    </Link>
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="font-[var(--font-display)] text-[1.35rem] leading-tight">
                        <Link to={`/products/${product.id}`} className="hover:text-green">
                          {product.name}
                        </Link>
                      </h2>
                      <p className="mt-2 line-clamp-2 text-[0.84rem] leading-relaxed text-ink/60">{product.tagline}</p>

                      <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-ink/10 py-2.5 text-center">
                        {[
                          { k: 'Coverage', v: `${product.coveragePerUnit} m²/L` },
                          { k: 'Coats', v: String(product.coatsRecommended) },
                          { k: 'Recoat', v: `${product.recoatHours} h` },
                        ].map((stat) => (
                          <div key={stat.k}>
                            <dt className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-ink/60">{stat.k}</dt>
                            <dd className="tabular text-[0.8rem] font-semibold">{stat.v}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                        <div>
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-ink/60">From · guide</p>
                          <p className="text-[0.95rem] font-semibold">
                            {from.length ? naira(Math.min(...from)) : 'On request'}
                          </p>
                        </div>
                        <Link
                          to={`/products/${product.id}`}
                          className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-green"
                        >
                          Details <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                        </Link>
                      </div>
                    </div>
                  </article>
                </Reveal>
              </li>
            )
          })}
        </ul>

        {/* comparison */}
        <section className="mt-16" aria-labelledby="compare-title">
          <SectionHead
            kicker="Side by side"
            title={<span id="compare-title">Which one goes where?</span>}
            lede="The specification table a painter or quantity surveyor actually needs, without the marketing layer."
          />
          <div className="mt-6 overflow-x-auto rounded-sm border border-ink/12">
            <table className="w-full min-w-[46rem] border-collapse text-left text-[0.82rem]">
              <caption className="sr-only">Comparison of OPUDA’S PAINT products by finish, coverage, coats and areas of use</caption>
              <thead>
                <tr className="bg-plaster/50 text-[0.66rem] uppercase tracking-[0.12em] text-ink/60">
                  <th scope="col" className="px-4 py-3 font-bold">Product</th>
                  <th scope="col" className="px-4 py-3 font-bold">Finish</th>
                  <th scope="col" className="px-4 py-3 font-bold">Sheen</th>
                  <th scope="col" className="px-4 py-3 font-bold">Coverage</th>
                  <th scope="col" className="px-4 py-3 font-bold">Coats</th>
                  <th scope="col" className="px-4 py-3 font-bold">Use</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTS.map((product) => (
                  <tr key={product.id} className="border-t border-ink/8 align-top">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      <Link to={`/products/${product.id}`} className="hover:text-green">
                        {product.name}
                      </Link>
                    </th>
                    <td className="px-4 py-3">{product.finish}</td>
                    <td className="px-4 py-3 text-ink/60">{FINISH_SHEEN_LABEL[product.finish]}</td>
                    <td className="tabular px-4 py-3">{product.coveragePerUnit} m²/{product.packs[0]?.unit === 'kg' ? 'kg' : 'L'}</td>
                    <td className="tabular px-4 py-3">{product.coatsRecommended}</td>
                    <td className="px-4 py-3 text-ink/60">{product.surfaces.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-[0.74rem] leading-relaxed text-ink/60">
            Coverage figures assume a sound, sealed surface and one coat. Porous new plaster absorbs more: budget 7–8 m²
            per litre for the first coat. Figures are transcribed from the product data sheets; where a sheet is still
            in technical review the row is marked <em>spec pending</em> on the product page.
          </p>
        </section>

        {/* guidance */}
        <section className="mt-16 grid gap-4 md:grid-cols-3" aria-label="Finish guidance">
          {[
            {
              icon: Layers,
              title: 'Interior walls',
              body: 'Matt for bedrooms and lounges, Silk for kitchens, corridors and children’s rooms. Silk is washable; Matt hides plaster imperfections better.',
            },
            {
              icon: Droplet,
              title: 'Anything outside',
              body: 'Weathershield on render, Gloss on metal. Never Matt on an exposed facade — a flat film cannot shed the rain.',
            },
            {
              icon: Check,
              title: 'Before either',
              body: 'Primer on every new or repaired surface, screeding to flatten blockwork. Skipping these is the most common cause of a failed paint job.',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <card.icon className="size-5 text-green" aria-hidden />
              <h3 className="mt-3 font-[var(--font-display)] text-[1.15rem]">{card.title}</h3>
              <p className="mt-1.5 text-[0.84rem] leading-relaxed text-ink/60">{card.body}</p>
            </div>
          ))}
        </section>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-ink px-5 py-5 text-paper-2">
          <div>
            <p className="font-[var(--font-display)] text-[1.3rem]">Not sure which system the elevation needs?</p>
            <p className="text-[0.82rem] text-paper-2/60">
              Send us photographs and the room type. We will specify the system and the litres.
            </p>
          </div>
          <ArrowLink to="/quote" className="text-paper-2">
            Request a specification
          </ArrowLink>
        </div>

        <p className="mt-6 text-[0.72rem] text-ink/60">
          {number(PRODUCTS.length)} products · all prices are indicative Lagos guides, excluding VAT and delivery
        </p>
      </div>
    </>
  )
}
