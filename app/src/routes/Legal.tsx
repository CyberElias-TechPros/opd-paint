import { Link, useParams } from 'react-router-dom'
import { usePageMeta } from '../lib/seo'
import { Kicker, ArrowLink } from '../components/ui/Bits'
import { BRAND_PHONE_DISPLAY } from '../data/dealers'
import NotFound from './NotFound'
import { DataRequestForm } from '../components/legal/DataRequestForm'
import { LEGAL_DOCS, findLegalDoc } from '../data/legal'



export default function Legal() {
  const { slug = '' } = useParams()
  const doc = findLegalDoc(slug)

  usePageMeta({
    title: doc ? doc.title : 'Legal',
    description: doc?.intro ?? 'Legal information for OPUDA’S PAINT.',
    path: `/legal/${slug}`,
    noIndex: !doc,
  })

  if (!doc) return <NotFound />

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Legal</Kicker>
          <h1 className="display text-[clamp(2rem,4.4vw,3.2rem)]">{doc.title}</h1>
          <p className="mt-3 text-[0.76rem] uppercase tracking-[0.12em] text-ink/72">Version {doc.updated}</p>
          <p className="mt-4 max-w-2xl text-[0.96rem] leading-relaxed text-ink/75">{doc.intro}</p>
        </div>
      </header>

      <div className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,1fr)]">
        <nav aria-label="Legal documents" className="lg:sticky lg:top-24 lg:self-start">
          <p className="kicker mb-3 text-ink/72">Documents</p>
          <ul className="space-y-1.5">
            {LEGAL_DOCS.map((item) => (
              <li key={item.slug}>
                <Link
                  to={`/legal/${item.slug}`}
                  className={`block rounded-sm px-3 py-2 text-[0.84rem] font-semibold transition-colors ${
                    item.slug === slug ? 'bg-ink text-paper-2' : 'text-ink/75 hover:bg-ink/5'
                  }`}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-[68ch]">
          {doc.sections.map((section, index) => (
            <section key={section.heading} className="mb-8">
              <h2 className="font-[var(--font-display)] text-[1.4rem]">
                <span className="mr-2 tabular text-[0.8rem] text-ink/72">{String(index + 1).padStart(2, '0')}</span>
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 30)} className="mt-2 text-[0.94rem] leading-[1.75] text-ink/70">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="mt-3 space-y-1.5 border-l-2 border-green/25 pl-4">
                  {section.list.map((item) => (
                    <li key={item} className="text-[0.9rem] leading-relaxed text-ink/75">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.form === 'data-request' ? <DataRequestForm /> : null}
            </section>
          ))}
          <p className="mt-10 border-t border-ink/12 pt-4 text-[0.78rem] text-ink/72">
            Questions about this document? Email hello@opudapaint.com or call {BRAND_PHONE_DISPLAY}.
          </p>
          <ArrowLink to="/data" className="mt-4">
            How we handle colour and product data
          </ArrowLink>
        </article>
      </div>
    </>
  )
}
