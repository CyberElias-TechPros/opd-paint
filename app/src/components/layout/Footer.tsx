import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Phone, MessageCircle, Mail, MapPin } from 'lucide-react'
import { LogoLockup } from '../brand/Logo'
import { PaintSwash } from '../brand/Devices'
import { BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL, WHATSAPP_NUMBER } from '../../data/dealers'
import { useApp } from '../../store/AppStore'
import { subscribe } from '../../lib/api'
import { track } from '../../lib/analytics'
import { cn } from '../../lib/cn'

const COLUMNS = [
  {
    title: 'Explore',
    links: [
      { to: '/colours', label: 'Colour library' },
      { to: '/colours?view=palettes', label: 'Curated palettes' },
      { to: '/products', label: 'Products' },
      { to: '/room-preview', label: 'Room preview' },
      { to: '/inspiration', label: 'Project gallery' },
    ],
  },
  {
    title: 'Decide',
    links: [
      { to: '/calculator', label: 'Paint calculator' },
      { to: '/advice', label: 'Guides & advice' },
      { to: '/dealers', label: 'Where to buy' },
      { to: '/quote', label: 'Request a quote' },
      { to: '/quote?type=trade', label: 'Trade & contract pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About OPUDA’S' },
      { to: '/about#sustainability', label: 'Sustainability' },
      { to: '/data', label: 'Colour & data accuracy' },
      { to: '/style-guide', label: 'Design system' },
      { to: '/legal/privacy', label: 'Privacy & cookies' },
    ],
  },
]

export function Footer() {
  const { grantConsent, denyConsent, consent, toast } = useApp()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      setError('Enter a valid email address, for example name@example.com.')
      return
    }
    setState('sending')
    track('newsletter_submit', { source: 'footer' })
    try {
      await subscribe(email, 'colour-notes')
      setState('done')
      setEmail('')
      toast('You’re on the list', { description: 'We only send when there is a new collection or a genuinely useful guide.' })
    } catch {
      setState('idle')
      setError('We could not reach the server. Please try again, or call 0902 642 4350.')
    }
  }

  return (
    <footer data-print="hide" className="relative mt-24 overflow-hidden bg-ink text-paper-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 8%, rgba(18,150,95,0.55), transparent 42%), radial-gradient(circle at 88% 100%, rgba(193,18,31,0.4), transparent 46%)',
        }}
      />
      <div className="shell relative py-14 sm:py-20">
        {/* the pail's brush stroke, closing the page the way the label opens */}
        <PaintSwash className="mb-10 h-3 w-24 opacity-90" />
        <div className="grid gap-12 lg:grid-cols-[1.15fr_2fr]">
          <div>
            <LogoLockup tone="paper" />
            <p className="mt-6 max-w-sm font-[var(--font-display)] text-[1.45rem] leading-[1.25] text-paper-2/90">
              Colour, made in Nigeria. Painted on more walls than any screen can show you.
            </p>
            <div className="mt-6 space-y-2.5 text-[0.85rem] text-paper-2/70">
              <a className="flex items-center gap-2.5 hover:text-paper-2" href={`tel:${BRAND_PHONE_TEL}`}>
                <Phone className="size-4 shrink-0" aria-hidden /> {BRAND_PHONE_DISPLAY}
              </a>
              <a
                className="flex items-center gap-2.5 hover:text-paper-2"
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <MessageCircle className="size-4 shrink-0" aria-hidden /> WhatsApp a colour advisor
              </a>
              <a className="flex items-center gap-2.5 hover:text-paper-2" href="mailto:hello@opudapaint.com">
                <Mail className="size-4 shrink-0" aria-hidden /> hello@opudapaint.com
              </a>
              <p className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0" aria-hidden /> Lagos, Nigeria · dealers nationwide
              </p>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="kicker text-paper-2/65">{column.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.to + link.label}>
                      <Link to={link.to} className="text-[0.85rem] text-paper-2/75 transition-colors hover:text-paper-2">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-8 border-t border-paper-2/12 pt-8 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <h3 className="font-[var(--font-display)] text-xl">Colour Notes</h3>
            <p className="mt-1.5 max-w-sm text-[0.82rem] leading-relaxed text-paper-2/60">
              New collections, site photographs and practical guides. Sent when there is something worth sending — not on a schedule.
            </p>
          </div>
          <form onSubmit={onSubmit} noValidate className="w-full">
            <label htmlFor="footer-email" className="kicker mb-2 block text-paper-2/65">
              Email address
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="footer-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError(null)
                  setState('idle')
                }}
                placeholder="you@example.com"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'footer-email-error' : 'footer-email-note'}
                className={cn(
                  'min-h-11 flex-1 rounded-[3px] border bg-paper-2/5 px-3.5 py-2.5 text-[0.88rem] text-paper-2 placeholder:text-paper-2/65 focus:ring-2 focus:ring-green-bright focus:ring-offset-2 focus:ring-offset-green-deep',
                  error ? 'border-crimson' : 'border-paper-2/20',
                )}
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-paper-2 px-5 text-[0.82rem] font-bold text-ink transition-colors hover:bg-green hover:text-paper-2 disabled:opacity-50"
              >
                {state === 'sending' ? 'Sending…' : state === 'done' ? 'Subscribed' : 'Subscribe'}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
            {error ? (
              <p id="footer-email-error" className="mt-2 text-[0.76rem] font-semibold text-[#ff9b94]">
                {error}
              </p>
            ) : (
              <p id="footer-email-note" className="mt-2 text-[0.72rem] text-paper-2/65">
                Unsubscribe in one click. We never sell your address.
              </p>
            )}
          </form>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-paper-2/12 pt-6 text-[0.72rem] text-paper-2/65 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} OPUDA’S PAINT. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/legal/terms" className="hover:text-paper-2">
              Terms
            </Link>
            <Link to="/legal/privacy" className="hover:text-paper-2">
              Privacy
            </Link>
            <Link to="/legal/accessibility" className="hover:text-paper-2">
              Accessibility
            </Link>
            <button
              type="button"
              onClick={() => {
                if (consent === 'granted') denyConsent()
                else grantConsent()
              }}
              className="hover:text-paper-2"
            >
              {consent === 'granted' ? 'Measurement: on' : 'Measurement: off'}
            </button>
            <a
              href="https://www.w3.org/WAI/WCAG22/quickref/"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-paper-2"
            >
              Built to WCAG 2.2 AA
            </a>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-[0.7rem] leading-relaxed text-paper-2/70">
          Colours shown on a screen are digital approximations and cannot guarantee a physical match. Paint appearance
          depends on lighting, substrate, finish and application. Always confirm with a sample pot or a physical chip.
          Prices shown as “guide price” are indicative, exclude VAT and delivery, and are not a quotation.
        </p>
      </div>
    </footer>
  )
}
