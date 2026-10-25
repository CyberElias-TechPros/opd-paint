import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Search, X, Phone, Layers, ChevronRight } from 'lucide-react'
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
  { to: '/dealers', label: 'Where to buy', note: 'Dealers across Nigeria' },
]

export function Header({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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

  const boardLabel = useMemo(
    () => (savedCount === 0 ? 'Your project' : `Your project (${savedCount})`),
    [savedCount],
  )

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
            <a className="inline-flex items-center gap-1.5 hover:text-paper-2" href={`tel:${BRAND_PHONE_TEL}`}>
              <Phone className="size-3" aria-hidden /> {BRAND_PHONE_DISPLAY}
            </a>
            <a
              className="hover:text-paper-2"
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              WhatsApp a colour advisor
            </a>
          </div>
        </div>
      </div>

      <header
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
                        'relative block rounded-sm px-3 py-2 text-[0.84rem] font-semibold transition-colors',
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
              className="group flex items-center gap-2 rounded-full border border-ink/12 px-2.5 py-2 text-ink/60 transition-colors hover:border-ink/35 hover:text-ink sm:px-3"
              aria-label="Search the site"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden text-[0.75rem] font-medium sm:inline">Search</span>
              <kbd className="hidden rounded border border-ink/15 px-1 py-0.5 text-[0.6rem] font-semibold text-ink/60 lg:inline">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setBoardOpen(true)}
              className="relative flex items-center gap-2 rounded-full border border-ink/12 px-2.5 py-2 text-ink/70 transition-colors hover:border-ink/35 hover:text-ink sm:px-3"
              aria-label={`${boardLabel} — open project board`}
            >
              <Layers className="size-4" aria-hidden />
              <span className="hidden text-[0.75rem] font-medium md:inline">Project</span>
              {savedCount > 0 ? (
                <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-crimson text-[0.6rem] font-bold text-white">
                  {savedCount}
                </span>
              ) : null}
            </button>

            <ButtonLink to="/quote" size="sm" className="hidden sm:inline-flex">
              Get a quote
            </ButtonLink>

            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-ink/12 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
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
      >
        <div
          className={cn(
            'absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-400',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMenuOpen(false)}
        />
        <div
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
                        <span className="tabular text-[0.6rem] font-bold text-ink/60">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="display text-[1.35rem]">{item.label}</span>
                      </span>
                      <span className="mt-0.5 block pl-6 text-[0.75rem] text-ink/60">{item.note}</span>
                    </span>
                    <ChevronRight className="size-4 text-ink/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 px-3 pb-6">
              <ButtonLink to="/quote" fullWidth size="md">
                Get a quote
              </ButtonLink>
              <ButtonLink to={`tel:${BRAND_PHONE_TEL}`} external variant="outline" fullWidth size="md">
                <Phone className="size-4" aria-hidden /> {BRAND_PHONE_DISPLAY}
              </ButtonLink>
              <ArrowLink to={`https://wa.me/${WHATSAPP_NUMBER}`} external className="pt-3 text-green">
                WhatsApp a colour advisor
              </ArrowLink>
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}
