import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Compass, MapPin, Navigation, Phone, Search, ShieldCheck, TriangleAlert } from 'lucide-react'
import { usePageMeta, localBusinessSchema } from '../lib/seo'
import {
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_TEL,
  DEALERS,
  SERVICES,
  STATES,
  WHATSAPP_NUMBER,
  directionsUrl,
  distanceKm,
  type Dealer,
} from '../data/dealers'
import { Kicker, Badge, Pill, ArrowLink } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { track } from '../lib/analytics'
import { cn } from '../lib/cn'

export default function Dealers() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [state, setState] = useState('All')
  const [service, setService] = useState<string>('All')
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = DEALERS.filter((dealer) => {
      if (state !== 'All' && dealer.state !== state) return false
      if (service !== 'All' && !dealer.services.includes(service as Dealer['services'][number])) return false
      if (q && !`${dealer.name} ${dealer.area} ${dealer.city} ${dealer.state} ${dealer.services.join(' ')}`.toLowerCase().includes(q))
        return false
      return true
    })
    if (origin) {
      return [...list].sort(
        (a, b) =>
          distanceKm(origin.lat, origin.lng, a.lat, a.lng) - distanceKm(origin.lat, origin.lng, b.lat, b.lng),
      )
    }
    return list
  }, [query, state, service, origin])

  usePageMeta({
    title: 'Where to buy',
    description:
      'Find an OPUDA’S PAINT dealer or trade counter. Port Harcourt, Bonny, Uyo, Calabar, Warri, Benin City, Owerri, Aba, Abuja and Lagos. Call ahead to confirm stock and pack sizes.',
    path: '/dealers',
    jsonLd: DEALERS.filter((d) => d.verified).map((dealer) => localBusinessSchema(dealer)),
  })

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('This browser does not support location. Use the search box instead.')
      return
    }
    setLocating(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocating(false)
        track('dealer_search', { method: 'geolocation' })
      },
      () => {
        setLocating(false)
        setLocationError('We could not read your location. Search by area instead — we do not store your coordinates either way.')
      },
      { timeout: 8000, maximumAge: 60_000 },
    )
  }

  // Schematic positions: relative geography only, no tile server involved.
  const bounds = useMemo(() => {
    if (!results.length) return null
    const lats = results.map((d) => d.lat)
    const lngs = results.map((d) => d.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    return {
      minLat,
      maxLat: maxLat === minLat ? minLat + 0.01 : maxLat,
      minLng,
      maxLng: maxLng === minLng ? minLng + 0.01 : maxLng,
    }
  }, [results])

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Where to buy</Kicker>
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <h1 className="display text-[clamp(2.3rem,4.8vw,3.8rem)]">
                {DEALERS.length} counters. <span className="italic">{STATES.length} states.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink/75">
                Brand trade counters and authorised dealers stock the full range. Call ahead to confirm the pack size and
                colour — we would rather you arrived certain than hopeful.
              </p>
            </div>
            <div className="rounded-sm border border-ink/12 bg-paper-2/70 p-4">
              <p className="kicker mb-2 text-ink/72">Straight to a human</p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  to={`https://wa.me/${WHATSAPP_NUMBER}`}
                  external
                  size="sm"
                >
                  WhatsApp
                </ButtonLink>
                <ButtonLink to={`tel:${BRAND_PHONE_TEL}`} external size="sm" variant="outline">
                  <Phone className="size-3.5" aria-hidden /> {BRAND_PHONE_DISPLAY}
                </ButtonLink>
              </div>
              <p className="mt-2 text-[0.72rem] text-ink/72">Monday to Saturday, 8am – 6pm.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="shell py-8">
        {/* grid-cols-1 on mobile, not the implicit auto column: an auto column is
            sized by its content's min-content width, and a <select> is as wide as
            its longest option. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:min-w-[13rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/72" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search an area, city or service"
                  aria-label="Search dealers"
                  className="field py-2 pl-9 text-[0.86rem]"
                />
              </div>
              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
                aria-label="Filter by state"
                // `w-auto` sizes a select to its longest option, which is
                // 670px of Nigerian state names and pushes the page sideways on
                // a phone. Full width until there is room for it to be inline.
                className="field w-full min-w-0 py-2 text-[0.82rem] sm:w-auto"
              >
                <option value="All">All states</option>
                {STATES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
                <Compass className={cn('size-3.5', locating && 'animate-spin')} aria-hidden />
                {locating ? 'Locating…' : origin ? 'Sorted by distance' : 'Use my location'}
              </Button>
            </div>

            <div className="no-scrollbar mt-2 flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by service">
              <Pill active={service === 'All'} onClick={() => setService('All')}>
                Any service
              </Pill>
              {SERVICES.map((option) => (
                <Pill key={option} active={service === option} onClick={() => setService(option)}>
                  {option}
                </Pill>
              ))}
            </div>

            {locationError ? (
              <p role="status" className="mt-3 rounded-sm border border-ink/15 bg-paper-2/70 px-3 py-2 text-[0.78rem] text-ink/72">
                {locationError}
              </p>
            ) : null}

            <p className="mt-4 text-[0.8rem] text-ink/72" aria-live="polite">
              {results.length} location{results.length === 1 ? '' : 's'}
              {origin ? ' — nearest first' : ''}
            </p>

            <ul className="mt-4 space-y-3">
              {results.map((dealer) => {
                const distance = origin ? distanceKm(origin.lat, origin.lng, dealer.lat, dealer.lng) : null
                return (
                  <li
                    key={dealer.id}
                    className="rounded-sm border border-ink/12 bg-paper-2/60 p-4 transition-colors hover:border-ink/25"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={dealer.kind === 'Brand trade counter' ? 'green' : 'line'}>{dealer.kind}</Badge>
                          {dealer.verified ? (
                            <Badge tone="gold">
                              <ShieldCheck className="size-2.5" aria-hidden /> Verified
                            </Badge>
                          ) : null}
                          {distance != null ? <span className="text-[0.7rem] text-ink/72">{distance} km away</span> : null}
                        </div>
                        <h2 className="mt-2 font-[var(--font-display)] text-[1.15rem] leading-tight">{dealer.name}</h2>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[0.8rem] text-ink/72">
                          <MapPin className="size-3.5 text-ink/72" aria-hidden />
                          {dealer.area}, {dealer.city} · {dealer.state}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <ButtonLink to={`tel:${BRAND_PHONE_TEL}`} external size="sm" variant="paper">
                          <Phone className="size-3.5" aria-hidden /> Call
                        </ButtonLink>
                        <ButtonLink to={directionsUrl(dealer)} external size="sm" variant="outline">
                          <Navigation className="size-3.5" aria-hidden /> Directions
                        </ButtonLink>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      <span className="text-[0.72rem] text-ink/72">{dealer.hours}</span>
                      <span className="flex flex-wrap gap-1">
                        {dealer.services.map((s) => (
                          <span key={s} className="rounded-full bg-ink/6 px-2 py-0.5 text-[0.64rem] font-semibold text-ink/72">
                            {s}
                          </span>
                        ))}
                      </span>
                    </div>

                    {!dealer.verified ? (
                      <p className="mt-2 flex items-start gap-1.5 text-[0.72rem] text-ink/72">
                        <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden />
                        Stock and opening hours for this counter are being confirmed. Please call before travelling.
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            {!results.length ? (
              <div className="mt-4">
                <EmptyState
                  title="No dealer matches that search"
                  body="Try a nearby state, or call the brand line — we can arrange delivery to most cities from Port Harcourt."
                  action={<Button onClick={() => { setQuery(''); setState('All'); setService('All') }}>Reset filters</Button>}
                />
              </div>
            ) : null}
          </div>

          {/* schematic map */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-sm border border-ink/12 bg-ink">
              <div className="relative aspect-[4/3] w-full">
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(252,249,243,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(252,249,243,0.14) 1px, transparent 1px)',
                    backgroundSize: '38px 38px',
                  }}
                />
                {bounds
                  ? results.map((dealer) => {
                      const x = ((dealer.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 82 + 9
                      const y = (1 - (dealer.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 78 + 11
                      return (
                        <button
                          key={dealer.id}
                          type="button"
                          onClick={() => {
                            setQuery(dealer.city)
                            document.getElementById('dealer-list')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className="group absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${x}%`, top: `${y}%` }}
                          aria-label={`${dealer.name}, ${dealer.city}`}
                          title={`${dealer.name} — ${dealer.city}`}
                        >
                          <span
                            className={cn(
                              'block size-2.5 rounded-full ring-2 transition-all group-hover:scale-150',
                              dealer.verified ? 'bg-green-bright ring-green-bright/30' : 'bg-gold ring-gold/30',
                            )}
                          />
                          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-ink/90 px-1.5 py-0.5 text-[0.6rem] font-semibold text-paper-2 opacity-0 transition-opacity group-hover:opacity-100">
                            {dealer.city}
                          </span>
                        </button>
                      )
                    })
                  : null}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-4">
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-paper-2/65">Schematic</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-paper-2/60">
                    Relative positions only — not a navigation map. Use “Directions” on a dealer for turn-by-turn
                    routing.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-paper-2/10 px-4 py-3 text-[0.68rem] text-paper-2/65">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-green-bright" /> Verified
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-gold" /> Confirming
                </span>
                <span>{origin ? 'Distance from you' : 'Whole network'}</span>
              </div>
            </div>

            <div className="mt-4 rounded-sm border border-ink/12 bg-paper-2/60 p-4">
              <p className="kicker mb-2 text-ink/72">Stocking the range?</p>
              <p className="text-[0.82rem] leading-relaxed text-ink/72">
                Dealer and distributor enquiries are handled by the commercial team. Tell us your area and current lines.
              </p>
              <ButtonLink to="/quote?type=dealer" size="sm" variant="paper" className="mt-3">
                Become a dealer
              </ButtonLink>
            </div>

            <div className="mt-4">
              <ArrowLink to="/colours">Choose a colour before you travel</ArrowLink>
            </div>
          </aside>
        </div>

        <p id="dealer-list" className="mt-10 max-w-3xl text-[0.72rem] leading-relaxed text-ink/72">
          Dealer locations are maintained by the commercial team and reviewed monthly. Addresses and opening hours can
          change without notice; the entry marked “verified” has been confirmed in the current review cycle. If a
          counter has moved, tell us on {BRAND_PHONE_DISPLAY} and we will correct it.{" "}
          <Link to="/data" className="underline hover:text-ink">
            How we maintain this data
          </Link>
          .
        </p>
      </div>
    </>
  )
}
