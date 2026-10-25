import { Link } from 'react-router-dom'
import { ArrowRight, Droplets, Factory, Leaf, Ruler, ShieldCheck, Sun, Users } from 'lucide-react'
import { usePageMeta, ORGANISATION_SCHEMA } from '../lib/seo'
import { COLORS } from '../data/colors'
import { SmartImage } from '../components/media/SmartImage'
import { Kicker, Badge, SectionHead, ArrowLink, DataRow } from '../components/ui/Bits'
import { ButtonLink } from '../components/ui/Button'
import { PRODUCTS } from '../data/products'
import { BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL, DEALERS, STATES } from '../data/dealers'

const PRINCIPLES = [
  {
    icon: Factory,
    title: 'We make it, so we can stand behind it',
    body: 'The paint is manufactured here, not imported and relabelled. That means we can answer a technical question about a batch, and fix a problem at source rather than blaming a supplier.',
  },
  {
    icon: Ruler,
    title: 'Specification before decoration',
    body: 'The most expensive paint in the world fails on a damp wall. We start with preparation, primer and the right system, then choose colour. That order is not negotiable.',
  },
  {
    icon: Sun,
    title: 'Built for this light and this weather',
    body: 'Harmattan dust, salt air, intense UV, months of rain. Our palettes and products are tested against a Nigerian site, not a European brochure.',
  },
  {
    icon: ShieldCheck,
    title: 'Five years, in writing',
    body: 'The Matt and Silk pails carry a five-year guarantee. A guarantee is only meaningful if the surface was prepared correctly, so we publish the preparation requirements too.',
  },
  {
    icon: Leaf,
    title: 'Lower odour, honestly described',
    body: 'Our interior emulsions are water-based and low-VOC, with anti-fungi additives for humid rooms. We describe what is on the label and in the data sheet — no greener-than-thou claims we cannot evidence.',
  },
  {
    icon: Users,
    title: 'Painters are the real customer',
    body: 'A home-owner chooses a colour once. A painter works with the product every week. Coverage, flow, open time and how it behaves on a roller matter as much as the shade on the card.',
  },
]

export default function About() {
  usePageMeta({
    title: 'About OPUDA’S PAINT',
    description:
      'OPUDA’S PAINT manufactures matt, silk, gloss and weather-resistant coatings in Nigeria. Our approach to specification, colour accuracy, preparation and the five-year guarantee.',
    path: '/about',
    image: '/media/project-porch-blue.webp',
    jsonLd: ORGANISATION_SCHEMA,
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <Kicker className="mb-4">About us</Kicker>
            <h1 className="display text-[clamp(2.3rem,5vw,4rem)]">
              A paint company that
              <br />
              <span className="italic">reads the wall first.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[1rem] leading-relaxed text-ink/70">
              OPUDA’S PAINT is a Nigerian manufacturer of decorative coatings. We supply matt and silk emulsions for
              interiors, weather-resistant coatings for facades and boundary walls, gloss for joinery and steel, and the
              primer and screeding that make all of them last.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/products">See the range</ButtonLink>
              <ButtonLink to="/dealers" variant="outline">
                Find a dealer
              </ButtonLink>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SmartImage name="project-stone-wall" aspect={3 / 4} sizes="(max-width: 1024px) 45vw, 22vw" className="rounded-sm" />
            <div className="grid gap-3">
              <SmartImage name="product-silk-bucket" aspect={1} sizes="22vw" className="rounded-sm" />
              <SmartImage name="project-gate" aspect={3 / 4} sizes="22vw" className="rounded-sm" />
            </div>
          </div>
        </div>
      </header>

      <section className="shell py-14" aria-labelledby="principles-title">
        <SectionHead
          kicker="How we work"
          title={<span id="principles-title">Six things we will not compromise on.</span>}
          lede="These are operating principles, not slogans. They are the reason our technical desk will ask you about the substrate before it asks which colour you like."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <article key={principle.title} className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <principle.icon className="size-5 text-green" aria-hidden />
              <h3 className="mt-3 font-[var(--font-display)] text-[1.15rem] leading-snug">{principle.title}</h3>
              <p className="mt-2 text-[0.85rem] leading-relaxed text-ink/60">{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-ink/10 bg-plaster/30 py-14" aria-labelledby="process-title">
        <div className="shell grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <Kicker className="mb-3">The process</Kicker>
            <h2 id="process-title" className="display text-[clamp(1.8rem,3.4vw,2.7rem)]">
              From a photograph to a painter with the right bucket.
            </h2>
            <ol className="mt-6 space-y-4">
              {[
                { step: 'Assess', detail: 'Photographs, dimensions and the state of the substrate. New render, old gloss, damp patches — each changes the specification.' },
                { step: 'Specify', detail: 'Primer, screeding where needed, then the product and the number of coats. This is written down, not assumed.' },
                { step: 'Choose', detail: 'Colour selection comes last, in the finish that will actually be used, with a physical sample wherever possible.' },
                { step: 'Quantify', detail: 'The calculator converts area to real pack sizes, so the site is not short at 5pm on the last wall.' },
                { step: 'Verify', detail: 'After application we look at the work in daylight. If a wall reads patchy, we diagnose why before repainting.' },
              ].map((item, index) => (
                <li key={item.step} className="flex gap-3">
                  <span className="tabular mt-0.5 text-[0.7rem] font-bold text-ink/60">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-[0.9rem] font-semibold">{item.step}</p>
                    <p className="text-[0.84rem] leading-relaxed text-ink/60">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <SmartImage name="project-painter" aspect={4 / 5} sizes="(max-width: 1024px) 92vw, 45vw" className="rounded-sm" />
        </div>
      </section>

      <section id="sustainability" className="shell py-14" aria-labelledby="sustainability-title">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Kicker className="mb-3">Materials &amp; sustainability</Kicker>
            <h2 id="sustainability-title" className="display text-[clamp(1.8rem,3.4vw,2.7rem)]">
              Fewer claims, clearer facts.
            </h2>
            <div className="mt-5 space-y-4 text-[0.93rem] leading-relaxed text-ink/70">
              <p>
                Our interior emulsions are water-based and low in volatile organic compounds. The label carries an
                anti-fungi additive for humid rooms and an eco-friendly positioning — both of which are printed on the
                pail you receive.
              </p>
              <p>
                Solvent-based products, such as the synthetic gloss, require ventilation and appropriate personal
                protective equipment. That is stated in the safety data sheet and on this site, rather than left to be
                discovered on site.
              </p>
              <p>
                Longer life is the most sustainable property a coating has: a wall that lasts five years instead of two
                uses less material, less transport and less labour. That is why the guarantee and the preparation
                requirements matter more than any single formulation claim.
              </p>
            </div>
            <p className="mt-4 rounded-sm border border-ink/12 bg-paper-2/60 p-4 text-[0.78rem] leading-relaxed text-ink/60">
              We publish this in plain language because sustainability claims are easy to make and hard to verify. Where
              we quote a figure, it comes from the product data sheet. Where we do not have a figure, we say so.
            </p>
          </div>
          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <p className="kicker mb-3 text-ink/60">At a glance</p>
            <dl>
              <DataRow label="Products in the range" value={PRODUCTS.length} />
              <DataRow label="Colours in the launch library" value={String(COLORS.length)} />
              <DataRow label="Dealer locations" value={DEALERS.length} />
              <DataRow label="States covered" value={STATES.length} />
              <DataRow label="Guarantee (Matt & Silk)" value="5 years" />
              <DataRow label="Base" value="Lagos, Nigeria" />
              <DataRow label="Colour desk" value={BRAND_PHONE_DISPLAY} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="green">
                <Droplets className="size-2.5" aria-hidden /> Water-based emulsions
              </Badge>
              <Badge tone="line">Documents on every product</Badge>
            </div>
            <a
              href={`tel:${BRAND_PHONE_TEL}`}
              className="mt-4 inline-flex items-center gap-2 rounded-[3px] border border-ink/20 px-3.5 py-2 text-[0.8rem] font-semibold hover:border-ink"
            >
              Ask a technical question <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-ink/10 bg-ink py-14 text-paper-2">
        <div className="shell flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-[var(--font-display)] text-[1.6rem]">Working on something that matters?</p>
            <p className="mt-1 text-[0.88rem] text-paper-2/70">
              Trade, contract and developer enquiries welcome. Tell us the scale and the timeline.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/quote?type=trade" variant="paper">
              Trade enquiry
            </ButtonLink>
            <Link
              to="/data"
              className="inline-flex items-center gap-2 rounded-[3px] border border-paper-2/30 px-4 py-3 text-[0.82rem] font-semibold hover:bg-paper-2 hover:text-ink"
            >
              How we handle data <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <div className="shell py-10">
        <ArrowLink to="/inspiration">See our sites</ArrowLink>
      </div>
    </>
  )
}
