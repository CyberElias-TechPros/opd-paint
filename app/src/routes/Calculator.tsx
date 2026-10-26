import { useSearchParams } from 'react-router-dom'
import { usePageMeta } from '../lib/seo'
import { PaintCalculator } from '../components/calculator/PaintCalculator'
import { Kicker, ArrowLink } from '../components/ui/Bits'
import { GUIDES } from '../data/guides'

export default function CalculatorPage() {
  const [params] = useSearchParams()

  usePageMeta({
    title: 'Paint calculator',
    description:
      'Work out how much paint a room needs. Enter the dimensions, deduct doors and windows, choose coats and finish, and get the exact pack combination to buy — with the arithmetic shown.',
    path: '/calculator',
    image: '/media/project-render-stage.webp',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'OPUDA’S PAINT calculator',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
    },
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-12">
          <Kicker className="mb-4">Paint calculator</Kicker>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <h1 className="display text-[clamp(2.3rem,4.8vw,3.8rem)]">
                The right number of <span className="italic">litres.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink/75">
                Measure the room, deduct the openings, add a trim allowance. We round up to real pack sizes and show you
                every line of the arithmetic, so nobody has to guess on site.
              </p>
            </div>
            <p className="text-[0.8rem] leading-relaxed text-ink/72">
              Assumes a sound, sealed surface. New plaster absorbs more paint — add one extra coat on a first
              decoration, and never skip primer.
            </p>
          </div>
        </div>
      </header>

      <section className="shell py-8">
        <PaintCalculator initialProductId={params.get('product') ?? undefined} />
      </section>

      <section className="shell pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Why two coats', cta: 'Why two coats, in practice', body: 'The first coat builds opacity into porous plaster. The second provides the continuous film that can be washed and lasts the guarantee period.', to: '/advice/matt-or-silk' },
            { title: 'Do not forget primer', cta: 'Read the primer data sheet', body: 'One coat of alkali-resisting primer on new render is the single biggest factor in whether a finish lasts five years.', to: '/products/primer' },
            { title: 'The maths, in full', cta: 'Work through the example', body: 'A worked example with real numbers, including how the handling allowance and pack rounding change the answer.', to: '/advice/how-much-paint' },
          ].map((card) => (
            <div key={card.title} className="rounded-sm border border-ink/12 bg-paper-2/50 p-5">
              <h2 className="font-[var(--font-display)] text-[1.1rem]">{card.title}</h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink/72">{card.body}</p>
              {/* Named, not "Read more": three identical links give a screen
                  reader — and a crawler — three useless destinations. */}
              <ArrowLink to={card.to} className="mt-3 text-green">
                {card.cta}
              </ArrowLink>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[0.72rem] text-ink/72">
          Related reading: {GUIDES.slice(0, 2).map((g) => g.title).join(' · ')}
        </p>
      </section>
    </>
  )
}
