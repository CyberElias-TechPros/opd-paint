import { Link } from 'react-router-dom'
import { ArrowRight, Compass, PaletteIcon, Phone } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { ButtonLink } from '../components/ui/Button'
import { Kicker } from '../components/ui/Bits'
import { COLORS } from '../data/colors'
import { BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL } from '../data/dealers'

export default function NotFound() {
  usePageMeta({
    title: 'Page not found',
    description: 'That page does not exist. Browse the colour library, the product range or the advice section instead.',
    path: '/404',
    noIndex: true,
  })

  const suggestions = COLORS.slice(0, 6)

  return (
    <section className="shell grid min-h-[70vh] items-center gap-10 py-16 lg:grid-cols-2">
      <div>
        <Kicker className="mb-4">404 — not here</Kicker>
        <h1 className="display text-[clamp(2.4rem,5.6vw,4.4rem)]">
          That wall is <span className="italic">blank.</span>
        </h1>
        <p className="mt-4 max-w-md text-[1rem] leading-relaxed text-ink/75">
          The page you were looking for has moved or never existed. Try the colour library, the product range, or one of
          the six colours below.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink to="/colours">
            <PaletteIcon className="size-4" aria-hidden /> Colour library
          </ButtonLink>
          <ButtonLink to="/products" variant="outline">
            <Compass className="size-4" aria-hidden /> Products
          </ButtonLink>
          <a
            href={`tel:${BRAND_PHONE_TEL}`}
            className="inline-flex items-center gap-2 rounded-[3px] px-4 py-3 text-[0.82rem] font-semibold text-ink/72 hover:text-ink"
          >
            <Phone className="size-4" aria-hidden /> {BRAND_PHONE_DISPLAY}
          </a>
        </div>
        <div className="mt-8 flex flex-wrap gap-2 text-[0.78rem]">
          {[
            { to: '/advice', label: 'Advice' },
            { to: '/inspiration', label: 'Projects' },
            { to: '/dealers', label: 'Where to buy' },
            { to: '/calculator', label: 'Calculator' },
            { to: '/quote', label: 'Request a quote' },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 font-semibold hover:border-ink hover:bg-ink hover:text-paper-2"
            >
              {link.label} <ArrowRight className="size-3" aria-hidden />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {suggestions.map((colour) => (
          <Link
            key={colour.id}
            to={`/colours/${colour.id}`}
            className="group overflow-hidden rounded-[3px] ring-1 ring-inset ring-black/10"
          >
            <div className="aspect-[3/4] transition-transform duration-500 group-hover:scale-105" style={{ background: colour.hex }} />
            <p className="bg-paper-2 px-2 py-1.5 text-[0.68rem] font-semibold">{colour.name}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
