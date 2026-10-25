import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { COLORS } from '../../data/colors'
import { PRODUCTS } from '../../data/products'
import { GUIDES } from '../../data/guides'
import { PROJECTS } from '../../data/projects'
import { PALETTES } from '../../data/palettes'
import { DEALERS } from '../../data/dealers'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/cn'
import { track } from '../../lib/analytics'

type Hit = { id: string; kind: 'Colour' | 'Product' | 'Guide' | 'Project' | 'Palette' | 'Dealer'; title: string; sub: string; href: string; hex?: string }

/**
 * Site search. Runs against the local content index so results appear as the
 * user types, with no network round-trip and no third-party service. The same
 * fields the API indexes server-side (name, code, family, tag) are matched here.
 */
function buildIndex(): Hit[] {
  return [
    ...COLORS.map<Hit>((colour) => ({
      id: colour.id,
      kind: 'Colour',
      title: colour.name,
      sub: `${colour.code} · ${colour.family} · ${colour.undertone}`,
      href: `/colours/${colour.id}`,
      hex: colour.hex,
    })),
    ...PRODUCTS.map<Hit>((product) => ({
      id: product.id,
      kind: 'Product',
      title: product.name,
      sub: `${product.finish} · ${product.surfaces.join(', ')}`,
      href: `/products/${product.id}`,
    })),
    ...PALETTES.map<Hit>((palette) => ({
      id: palette.id,
      kind: 'Palette',
      title: palette.name,
      sub: `${palette.season} · ${palette.roles[0]} led`,
      href: `/colours?palette=${palette.id}`,
    })),
    ...PROJECTS.map<Hit>((project) => ({
      id: project.id,
      kind: 'Project',
      title: project.title,
      sub: `${project.kind} · ${project.location}`,
      href: `/inspiration/${project.id}`,
    })),
    ...GUIDES.map<Hit>((guide) => ({
      id: guide.id,
      kind: 'Guide',
      title: guide.title,
      sub: `${guide.category} · ${guide.readMinutes} min read`,
      href: `/advice/${guide.id}`,
    })),
    ...DEALERS.map<Hit>((dealer) => ({
      id: dealer.id,
      kind: 'Dealer',
      title: dealer.name,
      sub: `${dealer.area}, ${dealer.city} · ${dealer.state}`,
      href: `/dealers?q=${encodeURIComponent(dealer.city)}`,
    })),
  ]
}

const INDEX = buildIndex()

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return INDEX.filter((hit) => ['Colour', 'Palette', 'Product'].includes(hit.kind)).slice(0, 6)
    }
    const terms = q.split(/\s+/)
    return INDEX.map((hit) => {
      const haystack = `${hit.title} ${hit.sub} ${hit.kind}`.toLowerCase()
      let score = 0
      terms.forEach((term) => {
        if (!haystack.includes(term)) return
        if (hit.title.toLowerCase().startsWith(term)) score += 6
        else if (hit.title.toLowerCase().includes(term)) score += 4
        else score += 1
      })
      return { hit, score }
    })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 9)
      .map((r) => r.hit)
  }, [query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      window.setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const go = (hit: Hit) => {
    track('cta_click', { target: 'search-result', kind: hit.kind, id: hit.id })
    onClose()
    navigate(hit.href)
  }

  return (
    <Modal open={open} onClose={onClose} title="Search" description="Colours, products, palettes, projects and advice." size="lg">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink/72" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((i) => Math.min(i + 1, results.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (event.key === 'Enter' && results[active]) {
              event.preventDefault()
              go(results[active])
            }
          }}
          placeholder="Try “silk”, “sage”, “OP-405”, “damp walls”…"
          aria-label="Search colours, products and advice"
          aria-describedby="search-help"
          className="field pl-10"
        />
      </div>
      <p id="search-help" className="mt-2 text-[0.72rem] text-ink/72">
        Use ↑ ↓ to move, Enter to open. Search covers colour codes too.
      </p>

      <ul className="mt-4 -mx-1 divide-y divide-ink/8">
        {results.map((hit, index) => (
          <li key={`${hit.kind}-${hit.id}`}>
            <button
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => go(hit)}
              className={cn(
                'flex w-full items-center gap-3 rounded-sm px-2 py-3 text-left transition-colors',
                index === active ? 'bg-ink/6' : 'hover:bg-ink/4',
              )}
            >
              {hit.hex ? (
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-[3px] ring-1 ring-inset ring-black/10"
                  style={{ background: hit.hex }}
                />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-[3px] bg-ink/6 text-[0.6rem] font-bold uppercase text-ink/72">
                  {hit.kind.slice(0, 3)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9rem] font-semibold">{hit.title}</span>
                <span className="block truncate text-[0.74rem] text-ink/72">{hit.sub}</span>
              </span>
              <span className="hidden shrink-0 text-[0.62rem] font-bold uppercase tracking-[0.13em] text-ink/72 sm:block">
                {hit.kind}
              </span>
              {index === active ? <CornerDownLeft className="size-3.5 text-ink/72" aria-hidden /> : null}
            </button>
          </li>
        ))}
        {!results.length ? (
          <li className="px-2 py-8 text-center">
            <p className="text-[0.9rem] font-semibold">Nothing matched “{query}”.</p>
            <p className="mt-1 text-[0.8rem] text-ink/72">
              Try a colour family, a product name or a code like OP-201.
            </p>
          </li>
        ) : null}
      </ul>
    </Modal>
  )
}
