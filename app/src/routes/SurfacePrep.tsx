import { usePageMeta } from '../lib/seo'
import { Kicker, ArrowLink } from '../components/ui/Bits'
import { SurfacePrepTool } from '../components/advice/SurfacePrepTool'
import { PREP_CONDITIONS } from '../data/surfacePrep'

export default function SurfacePrep() {
  usePageMeta({
    title: 'Surface preparation — what to do first',
    description:
      'Tell us what the wall is doing — new render, old gloss, a damp patch, salt bloom, or an exterior wall facing the weather — and get the preparation sequence in order, with the products it uses.',
    path: '/advice/surface-prep',
    image: '/media/project-cream-scaffold.webp',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to prepare a wall for painting',
      step: PREP_CONDITIONS.map((condition) => ({
        '@type': 'HowToSection',
        name: condition.label,
        itemListElement: condition.steps.map((step) => ({ '@type': 'HowToStep', text: step })),
      })),
    },
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Surface preparation</Kicker>
          <h1 className="display max-w-3xl text-[clamp(2.3rem,4.8vw,3.8rem)]">
            Most finish failures happen <span className="italic">before</span> the first coat.
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/75">
            A good paint applied over the wrong preparation still fails. This tool is the preparation sequence from
            our technical guides, sorted by what the wall is actually doing — not a general article, a plan for your
            situation.
          </p>
        </div>
      </header>

      <section className="shell py-8">
        <SurfacePrepTool />
      </section>

      <section className="shell pb-16">
        <p className="text-[0.78rem] text-ink/68">
          This covers the sequence, not every edge case. For anything structural — a persistent leak, rising damp, or
          cracking that keeps returning — fix the building first.{' '}
          <ArrowLink to="/advice/damp-and-mould" className="text-green">
            Read the full damp &amp; mould guide
          </ArrowLink>
          .
        </p>
      </section>
    </>
  )
}
