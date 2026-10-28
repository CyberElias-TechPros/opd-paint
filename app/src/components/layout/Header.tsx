import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Search, X, Phone, Layers, ChevronRight, MessageCircle } from 'lucide-react'
import { LogoLockup } from '../brand/Logo'
import { ButtonLink } from '../ui/Button'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/AppStore'
import { BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL, WHATSAPP_NUMBER } from '../../data/dealers'
import { ArrowLink } from '../ui/Bits'

const NAV = [
  { to: '/colours', label: 'Colours', note: 'The launch fan deck' },
  { to: '/products', label: 'Products', note: 'Matt, Silk, Gloss, exterior' },
  { to: '/room-preview', label: 'Room preview', note: 'Paint your own wall' },
  { to: '/inspiration', label: 'Inspiration', note: 'Real OPUDA’S sites' },
  { to: '/advice', label: 'Advice', note: 'Preparation and application' },
  { to: '/dealers', label: 'Dealers', note: 'Counters across Nigeria' },
]

export function Header({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { savedCount, setBoardOpen } = useApp()
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  // Keyboard behaviour for the drawer: focus moves in, Escape closes it, and
  // focus returns to the button that opened it. Without this the panel is a
  // visual overlay that a keyboard user can neither enter nor leave.
  useEffect(() => {
    if (!menuOpen) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setMenuOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <>
      <a
        href="#main"
        className="sr-only-focusable fixed left-3 top-3 z-[120] rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper-2"
      >
        Skip to content
      </a>

      {/* utility strip — factual only, no invented promotions */}
      <div className="relative z-50 hidden bg-ink text-paper-2/80 md:block">
        <div className="shell-wide flex items-center justify-between py-1.5 text-[0.7rem] tracking-[0.02em]">
          <p className="flex items-center gap-2">
            <span aria-hidden className="size-1.5 rounded-full bg-green-bright" />
            Manufactured in Nigeria · 5-year guarantee on Matt &amp; Silk
          </p>
          <div className="flex items-center gap-5">
            <a
              className="inline-flex items-center gap-1.5 font-semibold text-green-bright hover:text-paper-2"
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              WhatsApp a colour advisor
            </a>
            <a className="inline-flex items-center gap-1.5 hover:text-paper-2" href={`tel:${BRAND_PHONE_TEL}`}>
              <Phone className="size-3" aria-hidden /> {BRAND_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </div>

      <header
        data-print="hide"
        className={cn(
          'sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-500',
          scrolled
            ? 'border-b border-ink/10 bg-paper/88 shadow-[0_10px_30px_-30px_rgba(11,26,19,0.8)] backdrop-blur-xl'
            : 'border-b border-transparent bg-paper/70 backdrop-blur-sm',
        )}
      >
        <div className="shell-wide flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]">
          <LogoLockup />

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'relative block rounded-sm px-2.5 py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] transition-colors',
                        isActive ? 'text-green' : 'text-ink/75 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.label}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute inset-x-3 -bottom-0.5 h-[2px] origin-left bg-green transition-transform duration-300',
                            isActive ? 'scale-x-100' : 'scale-x-0',
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="group flex items-center gap-2 rounded-full border border-ink/12 px-2.5 py-2 text-ink/72 transition-colors hover:border-ink/35 hover:text-ink sm:px-3"
              aria-label="Search the site"
              // The shortcut belongs in the accessibility tree as a shortcut, not
              // as decorative text beside the word "Search" — that is what made
              // the visible text stop matching the accessible name. It is
              // announced by the palette itself once opened.
              aria-keyshortcuts="Control+K Meta+K"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden text-[0.75rem] font-medium sm:inline">Search</span>
            </button>

            <button
              type="button"
              onClick={() => setBoardOpen(true)}
              className="relative flex items-center gap-2 rounded-full border border-ink/12 px-2.5 py-2 text-ink/70 transition-colors hover:border-ink/35 hover:text-ink sm:px-3"
              // The visible text is "Project" plus, when it exists, the saved
              // count. The name has to contain both.
              aria-label={savedCount > 0 ? `Your project, ${savedCount} saved — open project board` : 'Your project — open project board'}
            >
              <Layers className="size-4" aria-hidden />
              <span className="hidden text-[0.75rem] font-medium md:inline">Project</span>
              {savedCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-crimson text-[0.6rem] font-bold text-white">
                  {savedCount}
                </span>
              ) : null}
            </button>

            <div className="hidden items-center gap-1.5 sm:flex">
              <ButtonLink to={`https://wa.me/${WHATSAPP_NUMBER}`} external size="sm">
                <MessageCircle className="size-3.5" aria-hidden /> WhatsApp us
              </ButtonLink>
              <ButtonLink to="/quote" size="sm" variant="outline" className="hidden lg:inline-flex">
                Get a quote
              </ButtonLink>
            </div>

            <button
              ref={triggerRef}
              type="button"
              className="grid size-10 place-items-center rounded-full border border-ink/12 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-[90] lg:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!menuOpen}
        // While closed the panel is still in the DOM for the transition, so it
        // must not be reachable by tab, a screen reader or a search engine.
        inert={!menuOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-400',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMenuOpen(false)}
        />
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={cn(
            'absolute inset-y-0 right-0 flex w-full max-w-[26rem] flex-col bg-paper-2 transition-transform duration-500 ease-[var(--ease-out-quint)]',
            menuOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <LogoLockup />
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setMenuOpen(false)}
              className="grid size-9 place-items-center rounded-full border border-ink/15"
              aria-label="Close menu"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-2 py-3">
            <ul>
              {NAV.map((item, index) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="group flex items-center justify-between gap-3 rounded-sm px-3 py-3.5 transition-colors hover:bg-ink/5"
                  >
                    <span>
                      <span className="flex items-baseline gap-2.5">
                        <span className="tabular text-[0.6rem] font-bold text-ink/72">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="display text-[1.5rem]">{item.label}</span>
                      </span>
                      <span className="mt-0.5 block pl-6 text-[0.75rem] text-ink/72">{item.note}</span>
                    </span>
                    <ChevronRight className="size-4 text-ink/72 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 px-3 pb-6">
              <ButtonLink to={`https://wa.me/${WHATSAPP_NUMBER}`} external fullWidth size="md">
                <MessageCircle className="size-4" aria-hidden /> WhatsApp a colour advisor
              </ButtonLink>
              <ButtonLink to="/quote" variant="outline" fullWidth size="md">
                Get a quote
              </ButtonLink>
              <ArrowLink to={`tel:${BRAND_PHONE_TEL}`} external className="pt-3 text-green">
                Call {BRAND_PHONE_DISPLAY}
              </ArrowLink>
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
