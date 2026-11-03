import { Link } from 'react-router-dom'
import { ClipboardList, Droplets, Layers, PaintBucket, Ruler, ScanEye } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { TOOL_CARDS, PREP_SITUATIONS } from '../data/tools'
import { PRODUCTS } from '../data/products'
import { Kicker, ArrowLink, Badge } from '../components/ui/Bits'
import { ButtonLink } from '../components/ui/Button'
import { Reveal } from '../components/motion/Reveal'
import { WHATSAPP_NUMBER } from '../data/dealers'

const ICONS: Record<string, typeof Ruler> = {
  'finish-finder': PaintBucket,
  'surface-prep': Droplets,
  calculator: Ruler,
  project: ClipboardList,
  'room-preview': ScanEye,
}

/**
 * The tools hub (roadmap 11.02).
 *
 * The calculator and the room preview already existed; what was missing was the
 * decision support around them — which finish, what preparation, and what to
 * actually buy, in order. This page is the front door to all five, and it states
 * plainly what each tool can and cannot decide for you.
 */
export default function Tools() {
  usePageMeta({
    title: 'Practical tools',
    description:
      'Five tools for a real job: a finish finder that specifies the system, surface-preparation sequences for new render, damp, flaking and salt bloom, the paint calculator, a printable project checklist and the room preview.',
    path: '/tools',
    image: '/media/project-render-stage.webp',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'OPUDA’S PAINT practical tools',
      itemListElement: TOOL_CARDS.map((tool, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tool.name,
        url: `https://opudapaint.com${tool.to}`,
      })),
    },
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Practical tools</Kicker>
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <div>
              <h1 className="display text-[clamp(2.3rem,4.8vw,3.8rem)]">
                Decide the job. <span className="italic">Then buy the paint.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink/75">
                Most mistakes on a painting job are made before anyone opens a tin: the wrong finish for the wear, a
                coat over a wall that was never dry, a quantity guessed in a hardware aisle. These tools answer those
                questions with the same product data the technical sheets are printed from.
              </p>
            </div>
            <div className="rounded-sm border border-ink/12 bg-paper-2/70 p-4">
              <p className="kicker mb-2 text-ink/72">What these tools will not do</p>
              <ul className="space-y-1.5 text-[0.8rem] leading-relaxed text-ink/75">
                <li>They do not quote a price — pricing depends on dealer, pack and delivery.</li>
                <li>They do not promise a colour match — a screen is not a dried film.</li>
                <li>They do not fix a building. Damp and structural faults come first.</li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <section className="shell py-10" aria-labelledby="tools-list">
        <h2 id="tools-list" className="sr-only">
          The five tools
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {TOOL_CARDS.map((tool, index) => {
            const Icon = ICONS[tool.id] ?? ClipboardList
            return (
              <Reveal as="li" key={tool.id} delay={index * 60} className="h-full">
                <Link
                  to={tool.to}
                  className="group flex h-full flex-col rounded-sm border border-ink/12 bg-paper-2/60 p-5 transition-colors hover:border-ink/35"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/6 text-ink">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="font-[var(--font-display)] text-[1.35rem] leading-tight">{tool.name}</span>
                  </span>
                  <span className="mt-3 flex-1 text-[0.86rem] leading-relaxed text-ink/72">{tool.summary}</span>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.13em] text-green">
                    Open the tool
                    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </Link>
              </Reveal>
            )
          })}
        </ul>
      </section>

      <section className="shell pb-10" aria-labelledby="finish-range">
        <div className="rounded-sm border border-ink/12 bg-paper-2/50 p-5 sm:p-7">
          <h2 id="finish-range" className="display text-[clamp(1.5rem,3vw,2.1rem)]">
            The finishes the finder chooses between
          </h2>
          <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-ink/72">
            Every recommendation the finish finder makes is one of these four products, read from the same record that
            prints the technical data sheet. Where a specification is still awaiting technical sign-off, the product page
            says so — the tool does not present a draft as a certainty.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCTS.filter((product) => ['matt', 'silk', 'gloss', 'weathershield'].includes(product.id)).map((product) => (
              <li key={product.id} className="rounded-sm border border-ink/12 bg-white/50 p-3.5">
                <Link to={`/products/${product.id}`} className="block text-[0.9rem] font-semibold hover:text-green">
                  {product.shortName}
                </Link>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-ink/72">{product.bestFor}</p>
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={product.claimsStatus === 'label-verified' ? 'green' : 'line'}>
                    {product.claimsStatus === 'label-verified' ? 'Claims from label' : 'Spec in review'}
                  </Badge>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="shell pb-10" aria-labelledby="prep-index">
        <h2 id="prep-index" className="display text-[clamp(1.5rem,3vw,2.1rem)]">
          Preparation situations covered
        </h2>
        <p className="mt-2 max-w-2xl text-[0.88rem] leading-relaxed text-ink/72">
          Each one is a full sequence — what to look for, what to do, in what order, with the products and the guide that
          carries the reasoning.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {PREP_SITUATIONS.map((situation) => (
            <li key={situation.id}>
              <Link
                to={`/tools/surface-prep?situation=${situation.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-3.5 py-2 text-[0.78rem] font-semibold text-ink/75 transition-colors hover:border-ink hover:text-ink"
              >
                {situation.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="shell pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-sm bg-ink px-5 py-6 text-paper-2 sm:px-7">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.16em] text-paper-2/65">
              <Layers className="size-3.5" aria-hidden /> Still unsure
            </p>
            <p className="mt-2 font-[var(--font-display)] text-[clamp(1.3rem,2.6vw,1.9rem)]">
              Send us the wall and we will specify it.
            </p>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-paper-2/65">
              A photograph of the surface, the room type and what it is used for is usually enough for the technical desk
              to answer properly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`https://wa.me/${WHATSAPP_NUMBER}`} external size="sm" variant="paper">
              WhatsApp the desk
            </ButtonLink>
            <ButtonLink
              to="/quote"
              size="sm"
              variant="outline"
              className="border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
            >
              Request a specification
            </ButtonLink>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          <ArrowLink to="/advice">Read the guides behind these tools</ArrowLink>
          <ArrowLink to="/data">How we maintain the data</ArrowLink>
        </div>
      </section>
    </>
  )
}
