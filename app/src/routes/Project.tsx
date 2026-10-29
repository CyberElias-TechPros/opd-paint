import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Printer, Share2, Users } from 'lucide-react'
import { usePageMeta, ORIGIN } from '../lib/seo'
import { useApp } from '../store/AppStore'
import { colorsByIds, COLOR_LRV } from '../data/colors'
import { PRODUCTS } from '../data/products'
import { orderProductsForWork } from '../lib/projectChecklist'
import { Kicker, Badge, ArrowLink } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { track } from '../lib/analytics'

const MAX_NAME = 60

/**
 * One page, two situations:
 *
 *  - Visited plainly (`/project`): this is your own saved board, shown full
 *    page instead of the slide-over — with a durable link to send it to
 *    someone, and a printable checklist in buying/working order.
 *  - Visited with `?name=&c=&p=` (from the "Copy link" button below, or a
 *    link someone sent you): a read-only view of *their* selection, with one
 *    job — let you add it to your own board, or print it as-is.
 *
 * No backend: the whole project is the three query parameters. That is
 * "durable" in the sense that matters here — it survives a closed tab, a new
 * device, a forwarded WhatsApp message — without needing anywhere to store
 * it.
 */
export default function Project() {
  const { board, renameBoard, importBoard } = useApp()
  const [params] = useSearchParams()
  const [copied, setCopied] = useState(false)

  const sharedName = params.get('name')?.trim().slice(0, MAX_NAME) || ''
  const sharedColourIds = params.get('c')?.split(',').filter(Boolean) ?? []
  const sharedProductIds = params.get('p')?.split(',').filter(Boolean) ?? []
  const isShared = Boolean(sharedName || sharedColourIds.length || sharedProductIds.length)

  const name = isShared ? (sharedName || 'A shared project') : board.boardName
  const colourIds = isShared ? sharedColourIds : board.savedColors
  const productIds = isShared ? sharedProductIds : board.savedProducts

  const colours = useMemo(() => colorsByIds(colourIds), [colourIds])
  const products = useMemo(
    () => orderProductsForWork(productIds.map((id) => PRODUCTS.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p))),
    [productIds],
  )

  const shareUrl = useMemo(() => {
    const origin = typeof window === 'undefined' ? ORIGIN : window.location.origin
    const url = new URL('/project', origin)
    url.searchParams.set('name', board.boardName)
    if (board.savedColors.length) url.searchParams.set('c', board.savedColors.join(','))
    if (board.savedProducts.length) url.searchParams.set('p', board.savedProducts.join(','))
    return url.toString()
  }, [board.boardName, board.savedColors, board.savedProducts])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      track('cta_click', { target: 'project-page-share', count: colours.length + products.length })
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      window.prompt('Copy this link to share your project:', shareUrl)
    }
  }

  const saveToMyDevice = () => {
    importBoard(
      colours.map((c) => c.id),
      products.map((p) => p.id),
    )
  }

  usePageMeta({
    title: isShared ? `${name} — a shared project` : 'Your project',
    description: isShared
      ? 'A colour and product selection shared from OPUDA’S PAINT. Review it, add it to your own project, or request a quote against it.'
      : 'Everything you have saved — colours, products and a printable, in-order preparation and paint checklist — on one page you can share or print.',
    path: '/project',
    noIndex: true,
  })

  const isEmpty = colours.length === 0 && products.length === 0

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40 print:border-0">
        <div className="shell py-10 sm:py-12">
          {isShared ? (
            <div className="mb-3 flex items-center gap-2 text-[0.76rem] font-bold uppercase tracking-[0.1em] text-green no-print">
              <Users className="size-4" aria-hidden /> Shared with you — view only
            </div>
          ) : (
            <Kicker className="mb-4 no-print">Your project</Kicker>
          )}
          <h1 className={isShared ? 'display text-[clamp(2rem,4.5vw,3.3rem)]' : 'sr-only'}>{name}</h1>
          {isShared ? null : (
            <input
              value={board.boardName}
              onChange={(event) => renameBoard(event.target.value.slice(0, MAX_NAME))}
              aria-label="Project name"
              className="display w-full max-w-2xl border-b border-transparent bg-transparent text-[clamp(2rem,4.5vw,3.3rem)] transition-colors hover:border-ink/20 focus:border-green print:border-0"
            />
          )}
          <p className="mt-3 max-w-xl text-[0.9rem] leading-relaxed text-ink/72">
            {colours.length} colour{colours.length === 1 ? '' : 's'} · {products.length} product
            {products.length === 1 ? '' : 's'}
          </p>

          <div className="mt-6 flex flex-wrap gap-2 no-print">
            {isShared ? (
              <Button onClick={saveToMyDevice} disabled={isEmpty}>
                Add to my project
              </Button>
            ) : (
              <Button onClick={copyLink} disabled={isEmpty}>
                {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                {copied ? 'Link copied' : 'Copy link to share'}
              </Button>
            )}
            <Button variant="paper" onClick={() => window.print()} disabled={isEmpty}>
              <Printer className="size-4" aria-hidden /> Print checklist
            </Button>
            <ButtonLink variant="outline" to={isShared ? '/project' : '/quote?from=board'}>
              {isShared ? 'Start my own project' : 'Request a quote for this'}
            </ButtonLink>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <div className="shell py-16">
          <EmptyState
            title={isShared ? 'This link has nothing in it' : 'Nothing saved yet'}
            body="Tap the bookmark on any colour or product across the site, then come back here."
            action={<ButtonLink to="/colours">Explore colours</ButtonLink>}
          />
        </div>
      ) : (
        <div className="shell py-8">
          {colours.length ? (
            <section aria-labelledby="project-colours" className="mb-10">
              <h2 id="project-colours" className="kicker mb-4 text-ink/72">
                Colours
              </h2>
              <div className="flex h-16 overflow-hidden rounded-[3px] ring-1 ring-inset ring-black/10 print:h-10">
                {colours.map((colour) => (
                  <span key={colour.id} className="flex-1" style={{ background: colour.hex }} title={colour.name} />
                ))}
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {colours.map((colour) => (
                  <li key={colour.id} className="flex items-center gap-3 rounded-sm border border-ink/10 bg-paper-2/50 p-3 print:border-ink/30">
                    <Link to={`/colours/${colour.id}`} className="shrink-0">
                      <span
                        className="block size-10 rounded-[3px] ring-1 ring-inset ring-black/10"
                        style={{ background: colour.hex }}
                        aria-hidden
                      />
                    </Link>
                    <div className="min-w-0">
                      <Link to={`/colours/${colour.id}`} className="block truncate text-[0.86rem] font-semibold hover:text-green">
                        {colour.name}
                      </Link>
                      <p className="truncate text-[0.72rem] text-ink/68">
                        {colour.code} · LRV ≈ {COLOR_LRV(colour)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.72rem] text-ink/68">
                Screens cannot guarantee a physical match. Confirm with a sample pot or dealer chip before buying in
                quantity.
              </p>
            </section>
          ) : null}

          {products.length ? (
            <section aria-labelledby="project-checklist" className="mb-10">
              <h2 id="project-checklist" className="kicker mb-1 text-ink/72">
                Checklist — in working order
              </h2>
              <p className="mb-4 text-[0.78rem] text-ink/68">
                Preparation and filler first, primer next, topcoats last. Tick each off as you go.
              </p>
              <ol className="space-y-5">
                {products.map((product, index) => (
                  <li key={product.id} className="rounded-sm border border-ink/12 bg-paper-2/50 p-5 print:border-ink/30">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-ink/25 text-[0.72rem] font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <Link to={`/products/${product.id}`} className="font-[var(--font-display)] text-[1.05rem] hover:text-green">
                            {product.name}
                          </Link>
                          <p className="text-[0.74rem] text-ink/68">{product.finish} · {product.coatsRecommended} coat{product.coatsRecommended === 1 ? '' : 's'} recommended</p>
                        </div>
                      </div>
                      <Badge tone={product.claimsStatus === 'label-verified' ? 'green' : 'line'}>
                        {product.claimsStatus === 'label-verified' ? 'Label verified' : 'Pending verification'}
                      </Badge>
                    </div>
                    <ul className="mt-4 space-y-2 border-l-2 border-green/30 pl-4">
                      {product.application.map((step) => (
                        <li key={step.step} className="text-[0.84rem] leading-relaxed text-ink/75">
                          <span className="font-semibold">☐ {step.step}.</span> {step.detail}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <p className="text-[0.74rem] text-ink/68 no-print">
            Prices vary by pack, dealer and delivery. <ArrowLink to="/quote?from=board" className="text-green">Request a quote</ArrowLink> for
            current pricing against this exact list.
          </p>
        </div>
      )}
    </>
  )
}
