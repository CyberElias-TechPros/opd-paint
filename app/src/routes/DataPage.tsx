import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Eye, FileJson, ShieldCheck } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { COLORS } from '../data/colors'
import { PRODUCTS } from '../data/products'
import { DEALERS } from '../data/dealers'
import { GUIDES } from '../data/guides'
import { ButtonLink } from '../components/ui/Button'
import { Kicker, Badge, DataRow } from '../components/ui/Bits'

type Status = 'verified' | 'pending' | 'estimated'

const DOMAINS: Array<{
  domain: string
  source: string
  status: Status
  note: string
}> = [
  {
    domain: 'Colour names and codes',
    source: 'OPUDA’S launch fan deck (digital proof)',
    status: 'pending',
    note: 'Codes are permanent from the day they are published. The launch set must be checked chip-by-chip against the physical fan deck before release.',
  },
  {
    domain: 'Digital colour values (hex)',
    source: 'Derived from the fan-deck proof',
    status: 'estimated',
    note: 'One sRGB value per colour. A hex value describes a screen, not a tin. Physical chips are the authority.',
  },
  {
    domain: 'Light reflectance value (LRV)',
    source: 'Calculated from relative luminance of the hex value',
    status: 'estimated',
    note: 'Always shown with “≈”. A measured LRV requires a spectrophotometer reading of a dried film, which we do not yet hold for every colour.',
  },
  {
    domain: 'Matt & Silk claims',
    source: 'Printed on the physical pail label',
    status: 'verified',
    note: 'High quality, walls and ceilings, smooth finish, better flow, extra coverage, anti-fungi additive, eco-friendly, weather resistance, 5-year guarantee.',
  },
  {
    domain: 'Supporting products (primer, gloss, weathershield, screeding)',
    source: 'Range specification, pending technical sign-off',
    status: 'pending',
    note: 'These are marked “spec in review” on their product pages. Coverage, recoat and dilution figures must be confirmed against the data sheets.',
  },
  {
    domain: 'Guide prices',
    source: 'Indicative Port Harcourt retail guide',
    status: 'pending',
    note: 'Excludes VAT and delivery, and is not a quotation. Must be replaced by a feed from the authoritative price list before launch.',
  },
  {
    domain: 'Dealer network',
    source: 'Commercial team trading areas',
    status: 'pending',
    note: 'Nine of fourteen entries are awaiting stock and hours confirmation and render with a “call ahead” note.',
  },
  {
    domain: 'Project photography',
    source: 'Supplied by OPUDA’S PAINT',
    status: 'verified',
    note: 'Photographs are unretouched site records. Client details are withheld; locations are given at city or estate level.',
  },
  {
    domain: 'Site record detail (dates, areas, durations)',
    source: 'Not stated',
    status: 'pending',
    note: 'We do not publish square metre counts or programme durations we cannot verify, so those fields are deliberately absent.',
  },
  {
    domain: 'Guides and technical advice',
    source: 'OPUDA’S technical desk',
    status: 'verified',
    note: 'Each guide carries a reviewer and an updated date. Content is general guidance and does not replace a site assessment.',
  },
]

const STATUS_META = {
  verified: { label: 'Verified', tone: 'green' as const, icon: CheckCircle2 },
  pending: { label: 'Pending', tone: 'gold' as const, icon: Clock },
  estimated: { label: 'Estimated', tone: 'line' as const, icon: Eye },
}

export default function DataPage() {
  usePageMeta({
    title: 'Data, colour accuracy & accessibility',
    description:
      'What OPUDA’S PAINT can and cannot guarantee about the colour and product data on this site: provenance for every field, the colour accuracy policy, accessibility conformance and the performance budget.',
    path: '/data',
    noIndex: false,
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Transparency</Kicker>
          <h1 className="display max-w-3xl text-[clamp(2.2rem,4.6vw,3.5rem)]">
            What we know, what we <span className="italic">estimate</span>, and what we do not publish.
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/65">
            A paint website is full of numbers that look authoritative. This page states, field by field, where each
            one comes from and how much weight it can carry. It exists because colour trust is the whole product.
          </p>
        </div>
      </header>

      <div className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)] lg:gap-14">
        <div>
          <h2 className="text-[1.2rem] font-semibold">Data provenance</h2>
          <div className="mt-4 overflow-x-auto rounded-sm border border-ink/12">
            <table className="w-full min-w-[42rem] border-collapse text-left text-[0.82rem]">
              <caption className="sr-only">Data domains with their source and verification status</caption>
              <thead className="bg-plaster/50 text-[0.62rem] uppercase tracking-[0.12em] text-ink/60">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">Field</th>
                  <th scope="col" className="px-4 py-3 font-bold">Source</th>
                  <th scope="col" className="px-4 py-3 font-bold">Status</th>
                  <th scope="col" className="px-4 py-3 font-bold">What that means</th>
                </tr>
              </thead>
              <tbody>
                {DOMAINS.map((row) => {
                  const meta = STATUS_META[row.status]
                  return (
                    <tr key={row.domain} className="border-t border-ink/8 align-top">
                      <th scope="row" className="px-4 py-3 font-semibold">
                        {row.domain}
                      </th>
                      <td className="px-4 py-3 text-ink/60">{row.source}</td>
                      <td className="px-4 py-3">
                        <Badge tone={meta.tone}>
                          <meta.icon className="size-2.5" aria-hidden /> {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-ink/60">{row.note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <section className="mt-10" aria-labelledby="accuracy-title">
            <h2 id="accuracy-title" className="text-[1.2rem] font-semibold">
              Colour accuracy policy
            </h2>
            <div className="mt-3 space-y-3 text-[0.93rem] leading-relaxed text-ink/70">
              <p>
                Every colour on this site is stored as a single sRGB hex value. That value is what the interface paints,
                and it is what the room preview uses. It is a digital approximation of a physical coating.
              </p>
              <p>
                A screen emits light; paint reflects it. Deep colours in particular appear more saturated on a display
                than on a wall, because no display is limited by the light falling on it. Display calibration, ambient
                light, the sheen of the finish, the porosity of the substrate and the time of day all move the perceived
                colour.
              </p>
              <p>
                We therefore never present a swatch as a match guarantee. Where a colour decision matters, we ask for a
                physical sample: a painted patch on the actual wall, viewed at the times of day the room is used.
              </p>
              <div className="flex items-start gap-3 rounded-sm border border-crimson/25 bg-crimson/5 p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden />
                <p className="text-[0.84rem] leading-relaxed text-ink/70">
                  <span className="font-semibold text-crimson">Do not</span> approve a colour from a phone screen alone,
                  and do not mix finishes on one wall to “see the difference” on a real job — approve the sample in the
                  finish you will actually buy.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="a11y-title">
            <h2 id="a11y-title" className="text-[1.2rem] font-semibold">
              Accessibility conformance
            </h2>
            <p className="mt-2 text-[0.93rem] leading-relaxed text-ink/70">
              The site is built against WCAG 2.2 level AA. That is a design target and an ongoing test obligation, not a
              badge we can award ourselves. Current position:
            </p>
            <ul className="mt-3 space-y-2 text-[0.88rem] text-ink/70">
              {[
                'Every interactive control is reachable and operable by keyboard, with a visible focus indicator.',
                'Colour is never the only carrier of meaning: every swatch is accompanied by its name and code.',
                'All photography carries descriptive alternative text, maintained in one file.',
                'The room preview offers a non-visual summary of the colour applied, and its controls are keyboard operable.',
                'Form errors are announced, associated with their field, and described in plain language.',
                'Motion respects prefers-reduced-motion; the marquee and reveals stop or simplify.',
                'Text is not rendered as images, and layouts reflow to 320px without horizontal scrolling of content.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.82rem] leading-relaxed text-ink/60">
              Manual screen-reader passes and an independent audit are still outstanding before launch. If something
              here is unusable for you, call {`0902 642 4350`} and we will complete the task with you directly — that is
              the fallback we are accountable for.{' '}
              <Link to="/legal/accessibility" className="underline hover:text-green">
                Full accessibility statement
              </Link>
              .
            </p>
          </section>

          <section className="mt-10" aria-labelledby="perf-title">
            <h2 id="perf-title" className="text-[1.2rem] font-semibold">
              Performance budget
            </h2>
            <div className="mt-3 overflow-hidden rounded-sm border border-ink/12">
              {[
                ['Largest Contentful Paint', '≤ 2.5 s on a mid-range Android over 4G'],
                ['Cumulative Layout Shift', '≤ 0.05 — every image reserves its space'],
                ['Interaction to Next Paint', '≤ 200 ms'],
                ['Initial JavaScript', '≤ 120 KB gzipped for the homepage route'],
                ['Photography', 'WebP, responsive sizes, inline blur placeholder, lazy below the fold'],
                ['Third-party scripts', 'One optional analytics tag, gated on consent'],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 border-b border-ink/8 px-4 py-3 last:border-0 sm:grid-cols-[1fr_1.4fr]">
                  <p className="text-[0.8rem] font-semibold">{label}</p>
                  <p className="text-[0.8rem] text-ink/60">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <p className="kicker mb-3 text-ink/60">In the library</p>
            <dl>
              <DataRow label="Colour records" value={COLORS.length} />
              <DataRow label="Products" value={PRODUCTS.length} />
              <DataRow label="Dealer entries" value={DEALERS.length} />
              <DataRow label="Published guides" value={GUIDES.length} />
              <DataRow label="Fields with provenance" value="10 / 10" />
            </dl>
          </div>

          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <p className="flex items-center gap-2 text-[0.86rem] font-semibold">
              <FileJson className="size-4 text-green" aria-hidden /> Structured data
            </p>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink/60">
              Pages emit schema.org markup for the organisation, product offers, colour records, guides and verified
              dealer locations. Markup is only emitted for fields that are also visible on the page.
            </p>
          </div>

          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <p className="flex items-center gap-2 text-[0.86rem] font-semibold">
              <ShieldCheck className="size-4 text-green" aria-hidden /> Privacy
            </p>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink/60">
              Photographs uploaded to the room preview are processed in the browser and never transmitted. Saved colours
              live in this browser’s local storage. Nothing is measured until you opt in.
            </p>
            <Link to="/legal/privacy" className="mt-2 inline-block text-[0.76rem] font-semibold text-green hover:underline">
              Read the privacy notice
            </Link>
          </div>

          <div className="rounded-sm bg-ink p-5 text-paper-2">
            <p className="font-[var(--font-display)] text-[1.1rem]">Found something wrong?</p>
            <p className="mt-1 text-[0.8rem] leading-relaxed text-paper-2/60">
              A colour that does not match the chip, a dealer that has moved, a figure that looks off. Tell us and we
              will correct it.
            </p>
            <Link to="/quote" className="mt-3 inline-block text-[0.78rem] font-bold uppercase tracking-[0.1em] text-paper-2 underline">
              Report a data issue
            </Link>
          </div>
        </aside>
      </div>

      {/*
        A provenance page can easily end in a cul-de-sac. It is the page a
        sceptical buyer lands on, so it ends the same way every other page does:
        with the one action that settles the question — a physical chip.
      */}
      <section className="shell pb-16 sm:pb-24">
        <div className="grid gap-6 rounded-sm border border-ink/12 bg-paper-2/70 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <Kicker className="mb-3">The only real answer</Kicker>
            <h2 className="display text-[clamp(1.7rem,3.4vw,2.5rem)]">
              A screen cannot settle a colour. A chip can.
            </h2>
            <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-ink/65">
              Everything on this page exists to be honest about that limit: the hex value is a digital proof, the LRV is
              an estimate until a dried film is measured, and the photograph on your wall is not the wall. Ask for a
              sample pot, or hold the fan deck against the light in the room.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <ButtonLink to="/quote?type=sample" size="lg" fullWidth>
              Request a sample pot
            </ButtonLink>
            <ButtonLink to="/dealers" size="lg" variant="outline" fullWidth>
              Find a dealer with a fan deck
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}
