import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, MessageCircle, Plus, Ruler, Trash2, TriangleAlert, Wind } from 'lucide-react'
import { calculate, type Opening, type Units } from '../../lib/calculator'
import { PRODUCTS, type Product } from '../../data/products'
import { number } from '../../lib/format'
import { Button, ButtonLink } from '../ui/Button'
import { Badge } from '../ui/Bits'
import { Toggle } from '../ui/Field'
import { useApp } from '../../store/AppStore'
import { track } from '../../lib/analytics'
import { cn } from '../../lib/cn'
import { WHATSAPP_NUMBER } from '../../data/dealers'

const PAINT_PRODUCTS = PRODUCTS.filter((p) => p.packs.some((pack) => pack.unit === 'L'))

let openingSeq = 0
const newOpening = (kind: Opening['kind'], units: Units): Opening => {
  openingSeq += 1
  const metric = units === 'metric'
  return {
    id: `opening-${openingSeq}`,
    kind,
    width: kind === 'door' ? (metric ? 0.9 : 3) : metric ? 1.2 : 4,
    height: kind === 'door' ? (metric ? 2.1 : 7) : metric ? 1.2 : 4,
    count: 1,
  }
}

export function PaintCalculator({ initialProductId }: { initialProductId?: string }) {
  const [units, setUnits] = useState<Units>('metric')
  const [mode, setMode] = useState<'dimensions' | 'area'>('dimensions')
  const [length, setLength] = useState(4.2)
  const [width, setWidth] = useState(3.6)
  const [height, setHeight] = useState(2.9)
  const [directArea, setDirectArea] = useState(48)
  const [openings, setOpenings] = useState<Opening[]>([newOpening('door', 'metric'), newOpening('window', 'metric')])
  const [coats, setCoats] = useState(2)
  const [includeCeiling, setIncludeCeiling] = useState(false)
  const [trimAllowance, setTrimAllowance] = useState(8)
  const [productId, setProductId] = useState(initialProductId ?? 'matt')
  const [started, setStarted] = useState(false)
  const { toast } = useApp()

  const product: Product = PAINT_PRODUCTS.find((p) => p.id === productId) ?? PAINT_PRODUCTS[0]

  const invalid = useMemo(() => {
    const errors: string[] = []
    if (mode === 'dimensions') {
      if (!(length > 0) || length > 100) errors.push('Room length must be between 0 and 100.')
      if (!(width > 0) || width > 100) errors.push('Room width must be between 0 and 100.')
      if (!(height > 0) || height > 20) errors.push('Wall height must be between 0 and 20.')
    } else if (!(directArea > 0) || directArea > 5000) {
      errors.push('Wall area must be between 1 and 5,000 m².')
    }
    return errors
  }, [mode, length, width, height, directArea])

  const result = useMemo(() => {
    if (invalid.length) return null
    return calculate({
      units,
      totalWallArea: mode === 'area' ? directArea : null,
      roomLength: mode === 'dimensions' ? length : Math.sqrt(directArea) * 0.9,
      roomWidth: mode === 'dimensions' ? width : Math.sqrt(directArea) * 0.6,
      wallHeight: mode === 'dimensions' ? height : Math.max(2.4, directArea / 40),
      openings: mode === 'dimensions' ? openings : [],
      coats,
      includeCeiling,
      trimAllowancePct: trimAllowance,
      coveragePerUnit: product.coveragePerUnit,
      packSizes: product.packs.map((p) => p.size),
      unit: 'L',
    })
  }, [invalid, units, mode, directArea, length, width, height, openings, coats, includeCeiling, trimAllowance, product])

  const areaLabel = units === 'imperial' ? 'ft' : 'm'

  const whatsappHref = result?.packs.length
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Hello OPUDA'S PAINT, I used the paint calculator: ${result.packs
          .map((p) => `${p.count} × ${p.size} L`)
          .join(' + ')} of ${product.shortName} (${coats} coat${coats > 1 ? 's' : ''}, ${Math.round(
          result.paintableArea,
        )} m²). Please send current pricing and stock.`,
      )}`
    : `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Hello OPUDA'S PAINT, I'd like pricing and stock for ${product.shortName}.`,
      )}`

  const updateOpening = (id: string, patch: Partial<Opening>) => {
    setOpenings((current) => current.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }

  const markStarted = () => {
    if (!started) {
      setStarted(true)
      track('calculator_start', { mode, units, product: product.id })
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
      {/* ------------------------------------------------------------- inputs */}
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (result) {
            track('calculator_complete', {
              product: product.id,
              paintableArea: Math.round(result.paintableArea),
              packs: result.packs.length,
            })
            toast('Estimate ready', {
              description: `${result.packs.map((p) => `${p.count} × ${p.size} L`).join(' + ')} of ${product.shortName}.`,
            })
          }
        }}
        onChange={markStarted}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-ink/15 p-0.5" role="group" aria-label="Units">
            {(['metric', 'imperial'] as Units[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                aria-pressed={units === u}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] transition-colors',
                  units === u ? 'bg-ink text-paper-2' : 'text-ink/72 hover:text-ink',
                )}
              >
                {u === 'metric' ? 'Metres' : 'Feet'}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full border border-ink/15 p-0.5" role="group" aria-label="Input method">
            {(['dimensions', 'area'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] transition-colors',
                  mode === m ? 'bg-ink text-paper-2' : 'text-ink/72 hover:text-ink',
                )}
              >
                {m === 'dimensions' ? 'Room size' : 'Wall area'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'dimensions' ? (
          <fieldset className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
            <legend className="kicker px-1 text-ink/72">Room dimensions</legend>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {[
                { label: `Length (${areaLabel})`, value: length, set: setLength, min: 0.5, max: 100, step: 0.1, id: 'len' },
                { label: `Width (${areaLabel})`, value: width, set: setWidth, min: 0.5, max: 100, step: 0.1, id: 'wid' },
                { label: `Wall height (${areaLabel})`, value: height, set: setHeight, min: 1, max: 20, step: 0.1, id: 'hei' },
              ].map((field) => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="mb-1 block text-[0.72rem] font-semibold text-ink/72">
                    {field.label}
                  </label>
                  <input
                    id={field.id}
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={field.value}
                    onChange={(event) => field.set(Number(event.target.value))}
                    className="field tabular py-2 text-[0.9rem]"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-ink/72">
              <Ruler className="size-3.5" aria-hidden /> Measure wall to wall at skirting level, then floor to ceiling.
            </p>
          </fieldset>
        ) : (
          <fieldset className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
            <legend className="kicker px-1 text-ink/72">Total wall area</legend>
            <div className="mt-2">
              <label htmlFor="area" className="mb-1 block text-[0.72rem] font-semibold text-ink/72">
                Paintable wall area (m²)
              </label>
              <input
                id="area"
                type="number"
                inputMode="decimal"
                min={1}
                max={5000}
                step={0.5}
                value={directArea}
                onChange={(event) => setDirectArea(Number(event.target.value))}
                className="field tabular py-2 text-[0.9rem]"
              />
            </div>
            <p className="mt-2 text-[0.72rem] text-ink/72">
              Use this if your architect or quantity surveyor has already given you an area.
            </p>
          </fieldset>
        )}

        {mode === 'dimensions' ? (
          <fieldset className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
            <div className="flex items-center justify-between">
              <legend className="kicker px-1 text-ink/72">Doors &amp; windows</legend>
              <span className="text-[0.68rem] text-ink/72">deducted from wall area</span>
            </div>
            <ul className="mt-2 space-y-2">
              {openings.map((opening) => (
                <li key={opening.id} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-[3px] bg-white/60 p-2">
                  <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr] items-end gap-2">
                    <div>
                      <label htmlFor={`${opening.id}-kind`} className="mb-0.5 block text-[0.64rem] font-semibold uppercase tracking-wide text-ink/72">
                        Type
                      </label>
                      <select
                        id={`${opening.id}-kind`}
                        value={opening.kind}
                        onChange={(event) => updateOpening(opening.id, { kind: event.target.value as Opening['kind'] })}
                        className="field py-1.5 text-[0.78rem]"
                      >
                        <option value="door">Door</option>
                        <option value="window">Window</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    {(['width', 'height', 'count'] as const).map((key) => (
                      <div key={key}>
                        <label htmlFor={`${opening.id}-${key}`} className="mb-0.5 block text-[0.64rem] font-semibold uppercase tracking-wide text-ink/72">
                          {key === 'count' ? 'Qty' : `${key} (${areaLabel})`}
                        </label>
                        <input
                          id={`${opening.id}-${key}`}
                          type="number"
                          min={key === 'count' ? 1 : 0}
                          step={key === 'count' ? 1 : 0.1}
                          value={opening[key]}
                          onChange={(event) => updateOpening(opening.id, { [key]: Number(event.target.value) } as Partial<Opening>)}
                          className="field tabular py-1.5 text-[0.8rem]"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenings((current) => current.filter((o) => o.id !== opening.id))}
                    className="mb-0.5 grid size-8 place-items-center rounded-full text-ink/72 transition-colors hover:bg-crimson/10 hover:text-crimson"
                    aria-label="Remove opening"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="paper" size="sm" onClick={() => setOpenings((c) => [...c, newOpening('door', units)])}>
                <Plus className="size-3.5" aria-hidden /> Door
              </Button>
              <Button type="button" variant="paper" size="sm" onClick={() => setOpenings((c) => [...c, newOpening('window', units)])}>
                <Plus className="size-3.5" aria-hidden /> Window
              </Button>
            </div>
          </fieldset>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
            <legend className="kicker px-1 text-ink/72">Coats</legend>
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="Number of coats">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCoats(n)}
                  aria-pressed={coats === n}
                  className={cn(
                    'rounded-[3px] border py-2 text-[0.82rem] font-semibold transition-colors',
                    coats === n ? 'border-ink bg-ink text-paper-2' : 'border-ink/15 hover:border-ink/40',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.7rem] text-ink/72">
              {coats === 1 ? 'One coat only works on a colour match. We do not recommend it.' : `${coats} coats is the standard specification.`}
            </p>
          </fieldset>

          <fieldset className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
            <legend className="kicker px-1 text-ink/72">Extras</legend>
            <div className="mt-2 space-y-2">
              <Toggle checked={includeCeiling} onChange={setIncludeCeiling} label="Include ceiling" description="Calculated at length × width" />
              <div>
                <label htmlFor="trim" className="flex items-center justify-between text-[0.72rem] font-semibold text-ink/72">
                  Trim allowance
                  <span className="tabular text-ink/72">{trimAllowance}%</span>
                </label>
                <input
                  id="trim"
                  type="range"
                  min={0}
                  max={20}
                  value={trimAllowance}
                  onChange={(event) => setTrimAllowance(Number(event.target.value))}
                />
                <p className="text-[0.7rem] text-ink/72">Skirting, reveals, cutting-in and touch-ups.</p>
              </div>
            </div>
          </fieldset>
        </div>

        <fieldset className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
          <legend className="kicker px-1 text-ink/72">Product</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PAINT_PRODUCTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductId(p.id)}
                aria-pressed={productId === p.id}
                className={cn(
                  'flex items-start gap-2 rounded-[3px] border p-2.5 text-left transition-colors',
                  productId === p.id ? 'border-ink bg-white/80 ring-1 ring-ink' : 'border-ink/12 hover:border-ink/40',
                )}
              >
                <span
                  className="mt-0.5 size-6 shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10"
                  style={{ background: p.id === 'silk' ? '#EDE6D8' : '#F8F5EE' }}
                  aria-hidden
                />
                <span>
                  <span className="block text-[0.8rem] font-semibold">{p.shortName}</span>
                  <span className="block text-[0.68rem] text-ink/72">{p.coveragePerUnit} m²/L per coat</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {invalid.length ? (
          <div role="alert" className="rounded-sm border border-crimson/30 bg-crimson/5 p-3">
            <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-crimson">
              <TriangleAlert className="size-4" aria-hidden /> Check these values
            </p>
            <ul className="mt-1 list-inside list-disc text-[0.78rem] text-crimson/90">
              {invalid.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>

      {/* ------------------------------------------------------------ results */}
      <div className="lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-sm border border-ink bg-ink text-paper-2 shadow-[0_40px_80px_-50px_rgba(11,26,19,0.8)]">
          <div className="border-b border-paper-2/12 px-5 py-4">
            <p className="kicker text-paper-2/65">Your estimate</p>
            <p className="mt-1 font-[var(--font-display)] text-xl">
              {product.shortName} · {coats} coat{coats > 1 ? 's' : ''}
            </p>
          </div>

          {result ? (
            <div className="space-y-5 px-5 py-5">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper-2/65">Buy</p>
                <ul className="mt-2 space-y-1.5">
                  {result.packs.map((pack) => (
                    <li key={pack.size} className="flex items-baseline justify-between gap-3">
                      <span className="text-[0.9rem]">
                        <span className="tabular text-[1.3rem] font-semibold">{pack.count}</span> ×{' '}
                        <span className="font-semibold">{pack.size} L</span>{' '}
                        <span className="text-paper-2/65">{product.shortName}</span>
                      </span>
                    </li>
                  ))}
                  {!result.packs.length ? <li className="text-[0.86rem] text-paper-2/60">Enter your dimensions to size the job.</li> : null}
                </ul>
              </div>

              <div className="rounded-[3px] border border-paper-2/20 bg-paper-2/8 px-3 py-3">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-paper-2/70">Get a price for this</p>
                <p className="mt-1 text-[0.76rem] leading-relaxed text-paper-2/70">
                  Pricing is not published on the site — it depends on your dealer and delivery. Send us this exact
                  quantity on WhatsApp and we will reply with current pricing and stock.
                </p>
                <ButtonLink
                  to={whatsappHref}
                  external
                  size="sm"
                  variant="paper"
                  className="mt-3 w-full justify-center"
                  onClick={() => track('cta_click', { target: 'whatsapp', source: 'calculator' })}
                >
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp this estimate
                </ButtonLink>
              </div>

              <dl className="space-y-0">
                <div className="flex items-baseline justify-between border-b border-paper-2/10 py-2">
                  <dt className="text-[0.76rem] text-paper-2/70">Paintable area</dt>
                  <dd className="tabular text-[0.86rem] font-semibold">{number(result.paintableArea, 1)} m²</dd>
                </div>
                <div className="flex items-baseline justify-between border-b border-paper-2/10 py-2">
                  <dt className="text-[0.76rem] text-paper-2/70">Litres per coat</dt>
                  <dd className="tabular text-[0.86rem] font-semibold">{number(result.amountPerCoat, 1)} L</dd>
                </div>
                <div className="flex items-baseline justify-between border-b border-paper-2/10 py-2">
                  <dt className="text-[0.76rem] text-paper-2/70">Total incl. 5% handling</dt>
                  <dd className="tabular text-[0.86rem] font-semibold">{number(result.amountWithAllowance, 1)} L</dd>
                </div>
                <div className="flex items-baseline justify-between py-2">
                  <dt className="text-[0.76rem] text-paper-2/70">You will have spare</dt>
                  <dd className="tabular text-[0.86rem] font-semibold">
                    {result.surplus > 0 ? `${number(result.surplus, 1)} L` : '—'}
                  </dd>
                </div>
              </dl>

              <details className="group rounded-[3px] border border-paper-2/15 px-3 py-2.5">
                <summary className="flex cursor-pointer items-center justify-between text-[0.76rem] font-semibold text-paper-2/80">
                  <span className="flex items-center gap-1.5">
                    <Info className="size-3.5" aria-hidden /> How this was calculated
                  </span>
                  <span className="text-paper-2/65 transition-transform group-open:rotate-180">▾</span>
                </summary>
                <ol className="mt-2 space-y-1 text-[0.72rem] leading-relaxed text-paper-2/70">
                  {result.formula.map((line) => (
                    <li key={line} className="tabular">
                      {line}
                    </li>
                  ))}
                </ol>
              </details>

              <div className="flex flex-wrap gap-2">
                <ButtonLink
                  to="/quote?from=calculator"
                  size="sm"
                  variant="outline"
                  className="flex-1 justify-center border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
                >
                  Request a quote instead
                </ButtonLink>
                <ButtonLink to="/dealers" size="sm" variant="outline" className="flex-1 justify-center border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink">
                  Find a dealer
                </ButtonLink>
              </div>
            </div>
          ) : (
            <p className="px-5 py-8 text-[0.86rem] text-paper-2/60">Fix the highlighted values to see your estimate.</p>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2.5 rounded-sm border border-ink/12 bg-paper-2/60 p-3">
            <Wind className="mt-0.5 size-4 shrink-0 text-ink/72" aria-hidden />
            <p className="text-[0.76rem] leading-relaxed text-ink/72">
              <span className="font-semibold text-ink">Do not forget primer.</span> On new or repaired plaster, one coat
              of primer roughly halves the topcoat’s absorption and is the difference between two coats and three.{' '}
              <Link to="/products/primer" className="underline hover:text-green">
                Size primer
              </Link>
              .
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-sm border border-ink/12 bg-paper-2/60 p-3">
            <Badge tone="green">Verified formula</Badge>
            <p className="text-[0.76rem] leading-relaxed text-ink/72">
              Calculations are covered by automated tests against independent worked examples. Coverage figures come
              from the product data sheet.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
