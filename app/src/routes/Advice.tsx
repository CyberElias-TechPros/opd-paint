import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { CATEGORIES, GUIDES } from '../data/guides'
import { SmartImage } from '../components/media/SmartImage'
import { Kicker, Pill, ArrowLink } from '../components/ui/Bits'
import { Reveal } from '../components/motion/Reveal'
import { longDate } from '../lib/format'

const FAQ = [
  {
    q: 'How many coats does a wall need?',
    a: 'Two full coats on a sealed, primed surface. Add a third when changing dramatically between light and dark, or when the previous colour is strong and the new one is pale.',
  },
  {
    q: 'Can I paint over damp?',
    a: 'No. Find and fix the source of the moisture first, then let the wall dry completely. Painting over damp traps water behind the film and it will blister.',
  },
  {
    q: 'Is primer really necessary?',
    a: 'On new plaster, yes — the alkali in cement render will attack the topcoat and uneven porosity will show as patches. On a sound, previously painted wall in good condition, spot-priming bare patches is usually enough.',
  },
  {
    q: 'How long before I can wash the wall?',
    a: 'Seven days for Matt and Silk. The film is touch-dry in an hour, but it is still curing. Washing early burnishes the finish permanently.',
  },
  {
    q: 'Will the colour on my phone match the tin?',
    a: 'Not exactly. A screen emits light, paint reflects it, and every display is calibrated differently. Use a sample pot or a dealer chip before committing.',
  },
]

export default function Advice() {
  const [category, setCategory] = useState<string>('All')
  const [open, setOpen] = useState<number | null>(0)

  const list = useMemo(
    () => (category === 'All' ? GUIDES : GUIDES.filter((guide) => guide.category === category)),
    [category],
  )

  usePageMeta({
    title: 'Advice & guides',
    description:
      'Practical painting guides for Nigerian conditions: preparing walls in humidity, estimating quantities, choosing between matt and silk, cutting in, damp and mould, and why screen colour differs from paint.',
    path: '/advice',
    image: '/media/project-painter.webp',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Advice</Kicker>
          <h1 className="display max-w-3xl text-[clamp(2.3rem,4.8vw,3.8rem)]">
            Guides written for <span className="italic">this climate.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/65">
            Humidity, cement render, harmattan dust and salt air. Everything here assumes a Nigerian site, is reviewed
            by our technical desk, and carries a date so you know how current it is.
          </p>
        </div>
      </header>

      <div className="shell py-8">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-2" role="group" aria-label="Filter guides by category">
          <Pill active={category === 'All'} onClick={() => setCategory('All')}>
            All
          </Pill>
          {CATEGORIES.map((option) => (
            <Pill key={option} active={category === option} onClick={() => setCategory(option)}>
              {option}
            </Pill>
          ))}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((guide, index) => (
            <Reveal key={guide.id} delay={index * 60}>
              <article className="group flex h-full flex-col overflow-hidden rounded-sm border border-ink/12 bg-paper-2/50 transition-all duration-500 hover:-translate-y-1 hover:bg-paper-2 hover:shadow-[0_30px_60px_-40px_rgba(11,26,19,0.45)]">
                <Link to={`/advice/${guide.id}`} className="overflow-hidden">
                  <SmartImage
                    name={guide.hero}
                    aspect={16 / 10}
                    sizes="(max-width: 768px) 92vw, 30vw"
                    imgClassName="transition-transform duration-[1.3s] group-hover:scale-[1.04]"
                  />
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-ink/60">
                    <span className="text-green">{guide.category}</span>
                    <span aria-hidden>·</span>
                    <span>{guide.readMinutes} min</span>
                  </div>
                  <h2 className="mt-2 font-[var(--font-display)] text-[1.25rem] leading-snug">
                    <Link to={`/advice/${guide.id}`} className="hover:text-green">
                      {guide.title}
                    </Link>
                  </h2>
                  <p className="mt-2 flex-1 text-[0.83rem] leading-relaxed text-ink/60">{guide.summary}</p>
                  <p className="mt-3 text-[0.68rem] text-ink/60">Reviewed {longDate(guide.updated)}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <section className="mt-16" aria-labelledby="faq-title">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Kicker className="mb-3">Questions we get daily</Kicker>
              <h2 id="faq-title" className="display text-[clamp(1.6rem,3vw,2.3rem)]">
                Short answers to the things painters ask on site.
              </h2>
              <p className="mt-3 text-[0.88rem] leading-relaxed text-ink/60">
                If the answer is not here, call the colour desk on 0902 642 4350. We would rather talk it through than
                have you buy the wrong bucket.
              </p>
              <ArrowLink to="/quote" className="mt-4">
                Ask a specific question
              </ArrowLink>
            </div>
            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {FAQ.map((item, index) => (
                <li key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(open === index ? null : index)}
                    aria-expanded={open === index}
                    className="flex w-full items-start justify-between gap-4 py-4 text-left"
                  >
                    <span className="text-[0.92rem] font-semibold">{item.q}</span>
                    <span aria-hidden className="mt-1 text-ink/60">
                      {open === index ? '−' : '+'}
                    </span>
                  </button>
                  {open === index ? (
                    <p className="max-w-prose pb-4 text-[0.86rem] leading-relaxed text-ink/65">{item.a}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-ink px-5 py-5 text-paper-2">
          <div>
            <p className="font-[var(--font-display)] text-[1.25rem]">Prefer a scheme drawn for your room?</p>
            <p className="text-[0.82rem] text-paper-2/60">Send photographs and dimensions; the colour desk replies with options.</p>
          </div>
          <Link
            to="/quote"
            className="inline-flex items-center gap-2 rounded-[3px] bg-paper-2 px-5 py-3 text-[0.82rem] font-bold text-ink transition-colors hover:bg-green hover:text-paper-2"
          >
            Request a consultation <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  )
}
