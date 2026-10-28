import { Link, useParams } from 'react-router-dom'
import { usePageMeta } from '../lib/seo'
import { Kicker, ArrowLink } from '../components/ui/Bits'
import { BRAND_PHONE_DISPLAY } from '../data/dealers'
import NotFound from './NotFound'

type Doc = {
  slug: string
  title: string
  updated: string
  intro: string
  sections: { heading: string; body: string[]; list?: string[] }[]
}

const DOCS: Doc[] = [
  {
    slug: 'privacy',
    title: 'Privacy notice',
    updated: '2026-10-26',
    intro:
      'This notice explains what OPUDA’S PAINT collects through this website, why, and what you can ask us to do about it. It is written to be read, not to be survived.',
    sections: [
      {
        heading: 'What we collect, and when',
        body: [
          'Enquiry forms: your name, phone number, and optionally an email address, the city or area of your project, the project type, and anything you write in the message field. We use these only to answer your enquiry.',
          'Newsletter: your email address, if you choose to subscribe. Unsubscribe is one click, in every message.',
          'Room preview: photographs you upload are read by your own browser. They are not transmitted to us or to any third party, and no copy is stored on a server.',
          'Project board: colours and products you save are stored in your browser’s local storage on your device. They are not sent to us until you submit an enquiry.',
        ],
      },
      {
        heading: 'Measurement',
        body: [
          'Analytics is off by default. Nothing is measured until you accept measurement in the cookie panel. If you decline, the site works identically and no measurement events are sent.',
          'When measurement is enabled we record page views and interaction events such as opening a colour, saving a colour, or completing the calculator. Events carry the colour or product reference and nothing that identifies you — no name, no email, no phone number, no free text.',
        ],
      },
      {
        heading: 'Fault reports',
        body: [
          'When a page breaks, your browser sends us a technical report so we can fix it: the error message, the page it happened on (without the part after the ? in the address), which version of the site it was, and your browser’s name. These reports are diagnostics, not measurement — they are sent whether or not you accept analytics, because there is no way to keep a broken page working otherwise.',
          'A fault report contains no name, no email address, no phone number and no form contents. Email addresses and long digit strings are stripped out before the report is stored, and reports are deleted with the rest of our server logs.',
        ],
      },
      {
        heading: 'What we never do',
        body: ['We do not sell your data. We do not add you to a marketing list because you asked for a quote.'],
        list: [
          'No advertising pixels or retargeting tags run on this site.',
          'No uploaded photograph leaves your device.',
          'No enquiry form submission is used for any purpose other than answering it.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'Enquiries are kept for 24 months so we can answer follow-up questions and honour guarantees, then deleted. Newsletter subscriptions are kept until you unsubscribe. Server logs are kept for 30 days.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          `You can ask for a copy of what we hold about you, ask us to correct it, or ask us to delete it. Write to hello@opudapaint.com or call ${BRAND_PHONE_DISPLAY}. We will respond within 30 days.`,
          'If you are unhappy with our response you may complain to the Nigeria Data Protection Commission.',
        ],
      },
      {
        heading: 'Where your data goes',
        body: [
          'Enquiries are stored on infrastructure controlled by OPUDA’S PAINT. Transactional email, where used, is delivered by a processor under a data-processing agreement. We do not transfer personal data outside Nigeria unless the recipient is covered by an adequacy decision or appropriate safeguards.',
        ],
      },
      {
        heading: 'Changes',
        body: ['If this notice changes materially we will note the revision date at the top of this page.'],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of use',
    updated: '2026-09-01',
    intro:
      'These terms cover your use of this website. They do not replace the terms of sale agreed with your dealer, which govern any purchase.',
    sections: [
      {
        heading: 'Colour and product information',
        body: [
          'Colours displayed on this site are digital approximations of physical products. They cannot guarantee a match. Light reflectance values shown with “≈” are calculated from the digital value, not measured from a dried film.',
          'This site does not publish prices. Current pricing depends on pack, dealer and delivery — contact us on WhatsApp or ask your nearest dealer for a quotation.',
          'Product coverage, drying times and recoat intervals come from the technical data sheet for the product. Where a data sheet is under review, the product page says so.',
        ],
      },
      {
        heading: 'Room preview and calculator',
        body: [
          'The room preview is a simulation for comparing options. It preserves the light and shadow in your photograph but cannot reproduce the reflectance of a real coating.',
          'The paint calculator produces an estimate from the measurements you enter. Site conditions, surface porosity and application method can change the quantity required. Always confirm against the tin and the data sheet.',
        ],
      },
      {
        heading: 'Your content',
        body: [
          'You keep ownership of any photograph you use in the room preview. Because the photograph never leaves your browser, we never receive a licence to it and cannot access it.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: ['Do not attempt to disrupt the site, scrape it at a rate that degrades service for others, or submit false enquiries.'],
      },
      {
        heading: 'Liability',
        body: [
          'We take reasonable care to keep the information on this site accurate, but it is provided without warranty. Nothing in these terms limits liability for death, personal injury or fraud, or any liability that cannot lawfully be limited.',
        ],
      },
      {
        heading: 'Governing law',
        body: ['These terms are governed by the laws of the Federal Republic of Nigeria.'],
      },
    ],
  },
  {
    slug: 'accessibility',
    title: 'Accessibility statement',
    updated: '2026-09-01',
    intro:
      'We are building this site to WCAG 2.2 level AA. This statement records where we are, what is still outstanding, and how to get help if something does not work for you.',
    sections: [
      {
        heading: 'Conformance status',
        body: [
          'Partially conformant with WCAG 2.2 AA. The design and implementation follow the standard, but independent manual testing with assistive technology and a formal audit are still outstanding before launch.',
        ],
      },
      {
        heading: 'What is in place',
        body: ['These are implemented and reviewed in code review:'],
        list: [
          'Semantic landmarks, one h1 per page, and a logical heading order.',
          'A skip link to main content as the first focusable element.',
          'Visible focus indicators on every interactive control, with a 3 px offset ring.',
          'Keyboard operation of dialogs, the project board, filters, the compare tray and the room preview controls, with focus trapped and restored in dialogs.',
          'Colour never used alone: swatches always carry a name and a code.',
          'Descriptive alternative text for all photography, reviewed as content.',
          'Form errors announced and associated with their field using aria-describedby.',
          'prefers-reduced-motion honoured for all animation and smooth scrolling.',
          'Layouts that reflow to 320 px and survive 200% text zoom.',
        ],
      },
      {
        heading: 'Known limitations',
        body: [
          'The room preview is inherently visual. Selecting a wall on a photograph requires pointing at the wall. For visitors who cannot use a pointer, the colour pages and the project boards carry the same colour records, and our colour desk will complete a consultation by phone.',
          'The dealer schematic is a decorative diagram; the same information is available as an ordered list of locations with directions links.',
          'Some older PDF documents in the range may not be tagged for screen readers. We will replace them with tagged documents and accessible HTML versions.',
        ],
      },
      {
        heading: 'Measuring colour in a non-visual way',
        body: [
          'Every colour page states the family, undertone, estimated LRV and hex value as text, together with its role in curated palettes. That is the information a colour advisor would use on the phone, and it is available without seeing the swatch.',
        ],
      },
      {
        heading: 'Feedback',
        body: [
          `If any part of this site prevents you from doing something, call ${BRAND_PHONE_DISPLAY} and we will complete the task with you directly. If you prefer to write, use the contact form and mention accessibility — those messages are routed to the same desk.`,
        ],
      },
      {
        heading: 'Assessment approach',
        body: [
          'Design tokens are checked for contrast at build time. Each release is reviewed against a WCAG 2.2 AA checklist covering perceivable, operable, understandable and robust criteria, with keyboard-only walkthroughs of the colour library, the calculator, the enquiry form and the room preview.',
        ],
      },
    ],
  },
]

export default function Legal() {
  const { slug = '' } = useParams()
  const doc = DOCS.find((d) => d.slug === slug)

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
            {DOCS.map((item) => (
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
