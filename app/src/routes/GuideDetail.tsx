import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BadgeCheck, Clock, UserCheck } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { GUIDES, findGuide } from '../data/guides'
import { findColor } from '../data/colors'
import { PRODUCTS } from '../data/products'
import { SmartImage } from '../components/media/SmartImage'
import { Badge, ArrowLink } from '../components/ui/Bits'
import { ColourCard } from '../components/colour/ColourCard'
import { ButtonLink } from '../components/ui/Button'
import { longDate } from '../lib/format'
import { cn } from '../lib/cn'
import NotFound from './NotFound'

export default function GuideDetail() {
  const { id = '' } = useParams()
  const guide = findGuide(id)

  usePageMeta({
    title: guide ? guide.title : 'Guide not found',
    description: guide?.summary ?? 'Guide not found.',
    path: `/advice/${id}`,
    image: guide ? `/media/${guide.hero}.webp` : undefined,
    noIndex: !guide,
    jsonLd: guide
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: guide.title,
          description: guide.summary,
          dateModified: guide.updated,
          author: { '@type': 'Organization', name: guide.reviewer },
          publisher: { '@type': 'Organization', name: 'OPUDA’S PAINT' },
        }
      : undefined,
  })

  if (!guide) return <NotFound />

  const related = GUIDES.filter((g) => g.id !== guide.id && g.category === guide.category).slice(0, 2)
  const fallback = GUIDES.filter((g) => g.id !== guide.id).slice(0, 2)
  const next = related.length ? related : fallback
  const colours = guide.relatedColors.map(findColor).filter(Boolean)
  const products = guide.relatedProducts.map((pid) => PRODUCTS.find((p) => p.id === pid)).filter(Boolean)

  return (
    <>
      <nav aria-label="Breadcrumb" className="shell pt-6">
        <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] text-ink/72">
          <li>
            <Link to="/advice" className="hover:text-ink">
              Advice
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-ink/70">
            {guide.category}
          </li>
        </ol>
      </nav>

      <article>
        <header className="shell py-8">
          <Badge tone="green">{guide.category}</Badge>
          <h1 className="display mt-4 max-w-3xl text-[clamp(2rem,4.4vw,3.4rem)]">{guide.title}</h1>
          <p className="mt-4 max-w-2xl text-[1rem] leading-relaxed text-ink/70">{guide.summary}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.74rem] text-ink/72">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden /> {guide.readMinutes} min read
            </span>
            <span className="flex items-center gap-1.5">
              <UserCheck className="size-3.5" aria-hidden /> Reviewed by {guide.reviewer}
            </span>
            <span>Updated {longDate(guide.updated)}</span>
          </div>
        </header>

        <div className="shell">
          <SmartImage
            name={guide.hero}
            aspect={21 / 9}
            priority
            sizes="100vw"
            className="rounded-sm"
          />
        </div>

        <div className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)] lg:gap-14">
          <div className="max-w-[68ch]">
            {guide.sections.map((section, index) => (
              <section key={section.heading} className="mb-9" aria-labelledby={`section-${index}`}>
                <h2 id={`section-${index}`} className="font-[var(--font-display)] text-[1.5rem] leading-tight">
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 28)} className="mt-3 text-[0.97rem] leading-[1.8] text-ink/75">
                    {paragraph}
                  </p>
                ))}
                {section.list ? (
                  <ul className="mt-4 space-y-2 border-l-2 border-green/30 pl-4">
                    {section.list.map((item) => (
                      <li key={item} className="text-[0.92rem] leading-relaxed text-ink/70">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.callout ? (
                  <div
                    className={cn(
                      'mt-5 rounded-sm border-l-2 p-4',
                      section.callout.tone === 'warning'
                        ? 'border-crimson bg-crimson/5'
                        : section.callout.tone === 'tip'
                          ? 'border-green bg-green/5'
                          : 'border-ink/30 bg-ink/4',
                    )}
                  >
                    <p className="flex items-center gap-1.5 text-[0.82rem] font-bold">
                      <BadgeCheck
                        className={cn('size-4', section.callout.tone === 'warning' ? 'text-crimson' : 'text-green')}
                        aria-hidden
                      />
                      {section.callout.title}
                    </p>
                    <p className="mt-1 text-[0.86rem] leading-relaxed text-ink/70">{section.callout.body}</p>
                  </div>
                ) : null}
              </section>
            ))}

            <section className="mt-10 border-t border-ink/12 pt-6" aria-labelledby="guide-faq">
              <h2 id="guide-faq" className="font-[var(--font-display)] text-[1.3rem]">
                Quick answers
              </h2>
              <dl className="mt-3 space-y-4">
                {guide.faq.map((item) => (
                  <div key={item.q}>
                    <dt className="text-[0.9rem] font-semibold">{item.q}</dt>
                    <dd className="mt-1 text-[0.88rem] leading-relaxed text-ink/75">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className="mt-8 rounded-sm bg-plaster/40 p-4 text-[0.76rem] leading-relaxed text-ink/72">
              This guide is general technical guidance for a Nigerian site. It does not replace the product data sheet
              or a site assessment. Where a wall is damp, salt-bloomed or structurally unsound, fix the cause before
              specifying a finish.
            </p>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {products.length ? (
              <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
                <p className="kicker mb-2 text-ink/72">Products mentioned</p>
                <ul className="space-y-2">
                  {products.map((product) =>
                    product ? (
                      <li key={product.id}>
                        <Link to={`/products/${product.id}`} className="group flex items-center justify-between gap-2 text-[0.84rem]">
                          <span className="font-semibold group-hover:text-green">{product.shortName}</span>
                          <span className="text-ink/72">{product.finish}</span>
                        </Link>
                      </li>
                    ) : null,
                  )}
                </ul>
                <ButtonLink to="/calculator" size="sm" fullWidth className="mt-3">
                  Size it now
                </ButtonLink>
              </div>
            ) : null}

            {colours.length ? (
              <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
                <p className="kicker mb-2 text-ink/72">Colours mentioned</p>
                <div className="grid grid-cols-3 gap-2">
                  {colours.map((colour) => (colour ? <ColourCard key={colour.id} colour={colour} height="compact" showMeta={false} /> : null))}
                </div>
                <ArrowLink to="/colours" className="mt-3 text-green">
                  Library
                </ArrowLink>
              </div>
            ) : null}

            <div className="rounded-sm bg-ink p-4 text-paper-2">
              <p className="font-[var(--font-display)] text-[1.05rem]">Still unsure?</p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-paper-2/60">
                Send a photograph of the wall and we will tell you what we would specify.
              </p>
              <ButtonLink to="/quote" size="sm" variant="paper" fullWidth className="mt-3">
                Ask the colour desk
              </ButtonLink>
            </div>
          </aside>
        </div>
      </article>

      <section className="border-t border-ink/10 bg-plaster/30 py-10">
        <div className="shell">
          <div className="flex items-end justify-between gap-4">
            <h2 className="display text-[1.5rem]">Keep reading</h2>
            <ArrowLink to="/advice">All guides</ArrowLink>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {next.map((item) => (
              <Link
                key={item.id}
                to={`/advice/${item.id}`}
                className="group flex items-center gap-3 rounded-sm border border-ink/12 bg-paper-2/60 p-3 transition-colors hover:border-ink/30"
              >
                <SmartImage name={item.hero} aspect={1} sizes="80px" className="w-20 shrink-0 rounded-[2px]" />
                <span>
                  <span className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-green">{item.category}</span>
                  <span className="mt-0.5 block text-[0.9rem] font-semibold leading-snug group-hover:text-green">{item.title}</span>
                </span>
                <ArrowRight className="ml-auto size-4 shrink-0 text-ink/72 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            ))}
          </div>
          <Link to="/advice" className="mt-8 inline-flex items-center gap-2 text-[0.8rem] font-semibold hover:text-green">
            <ArrowLeft className="size-4" aria-hidden /> Back to advice
          </Link>
        </div>
      </section>
    </>
  )
}
