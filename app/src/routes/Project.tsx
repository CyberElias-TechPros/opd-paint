import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Check,
  ClipboardList,
  Copy,
  FileDown,
  Layers,
  MessageCircle,
  Printer,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { colorsByIds } from '../data/colors'
import { PRODUCTS, findProduct } from '../data/products'
import { PREP_SITUATIONS } from '../data/tools'
import { buildChecklist, checklistToText, prepByIds, type SavedEstimate } from '../lib/advisor'
import { SHARE_PARAM, decodeProject, projectUrl, type SharedProject } from '../lib/share'
import { Kicker, Badge, ArrowLink } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useApp } from '../store/AppStore'
import { track } from '../lib/analytics'
import { cn } from '../lib/cn'
import { WHATSAPP_NUMBER } from '../data/dealers'

/**
 * The project page (roadmap 11.02.04, 11.02.05, 11.01.15).
 *
 * Three jobs in one place:
 *   • **Checklist** — everything saved on this device (colours, products, the
 *     quantities the calculator produced, the preparation situations chosen)
 *     turned into the order of work: what to confirm, what to buy, what to do
 *     first. Print it, copy it as text, or download it.
 *   • **Share** — the same project encoded into a link. No account, no backend,
 *     no personal data: colour codes and quantities only. Opening somebody
 *     else's link offers to merge it into your own board.
 *   • **Hand-off** — the whole thing goes to the quote form as one enquiry, with
 *     the quantities attached, so the desk does not have to ask again.
 */
export default function Project() {
  const [params] = useSearchParams()
  const {
    board,
    renameBoard,
    removeColor,
    toggleProduct,
    removeEstimate,
    togglePrep,
    mergeSharedProject,
    clearBoard,
    toast,
  } = useApp()

  const [copied, setCopied] = useState(false)
  const [ticked, setTicked] = useState<Record<string, boolean>>({})

  const shared = useMemo(() => decodeProject(params.get(SHARE_PARAM)), [params])

  // A shared link is a *view* until the visitor saves it. Merging on arrival
  // would overwrite a board they built themselves, which is the kind of silent
  // data loss a tool like this must not commit.
  const [mergedToken, setMergedToken] = useState<string | null>(null)
  const alreadyMerged = shared ? mergedToken === params.get(SHARE_PARAM) : false

  const colours = useMemo(() => colorsByIds(board.savedColors), [board.savedColors])
  const products = useMemo(
    () => board.savedProducts.map((id) => findProduct(id)).filter((product): product is NonNullable<typeof product> => Boolean(product)),
    [board.savedProducts],
  )
  const prep = useMemo(() => prepByIds(board.prep), [board.prep])

  const sharedColours = useMemo(() => (shared ? colorsByIds(shared.colours) : []), [shared])
  const sharedProducts = useMemo(
    () => (shared ? shared.products.map((id) => findProduct(id)).filter(Boolean) : []),
    [shared],
  )
  const sharedPrep = useMemo(() => (shared ? prepByIds(shared.prep) : []), [shared])

  const groups = useMemo(
    () => buildChecklist({ projectName: board.boardName, colours, products, estimates: board.estimates, prep }),
    [board.boardName, colours, products, board.estimates, prep],
  )
  const sharedGroups = useMemo(
    () =>
      shared
        ? buildChecklist({
            projectName: shared.name,
            colours: sharedColours,
            products: sharedProducts.filter((product): product is NonNullable<typeof product> => Boolean(product)),
            estimates: shared.estimates,
            prep: sharedPrep,
          })
        : [],
    [shared, sharedColours, sharedProducts, sharedPrep],
  )

  const activeGroups = shared && !alreadyMerged ? sharedGroups : groups
  const activeName = shared && !alreadyMerged ? shared.name : board.boardName
  const isEmpty = !colours.length && !products.length && !board.estimates.length

  usePageMeta({
    title: shared && !alreadyMerged ? `Shared project — ${shared.name}` : 'Your project checklist',
    description:
      'Turn a saved project into an ordered checklist: what to confirm, what to buy, how to prepare the surface and how to apply it. Print it, copy it, share it as a link, or send the whole thing to the colour desk as one enquiry.',
    path: '/project',
    // A board is device-specific and a shared link carries a token: neither
    // belongs in an index.
    noIndex: true,
  })

  useEffect(() => {
    if (shared && !alreadyMerged) track('project_shared_opened', { colours: shared.colours.length, products: shared.products.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const asSharePayload = (): SharedProject => ({
    name: board.boardName,
    colours: board.savedColors,
    products: board.savedProducts,
    estimates: board.estimates,
    prep: board.prep,
  })

  const shareLink = async () => {
    const url = projectUrl(asSharePayload())
    const payload = {
      title: `${board.boardName} — OPUDA’S PAINT project`,
      text: `${colours.length} colour${colours.length === 1 ? '' : 's'} and ${board.estimates.length} quantity estimate${
        board.estimates.length === 1 ? '' : 's'
      }, saved as a checklist.`,
      url,
    }
    track('project_shared_created', { colours: colours.length, products: products.length, estimates: board.estimates.length })
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(payload)
        return
      }
    } catch {
      // A dismissed share sheet is not a failure; fall through to the clipboard.
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast('Project link copied', { description: 'It opens your checklist on any device — no account needed.' })
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      window.prompt('Copy this project link:', url)
    }
  }

  const copyText = async () => {
    const text = checklistToText(activeName, activeGroups)
    try {
      await navigator.clipboard.writeText(text)
      toast('Checklist copied', { description: `${activeGroups.length} sections, ready to paste into a message.` })
    } catch {
      window.prompt('Copy your checklist:', text)
    }
  }

  const downloadText = () => {
    try {
      const text = checklistToText(activeName, activeGroups)
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(activeName || 'opudas-project').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-checklist.txt`
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoking immediately can cancel the download in some browsers; the URL
      // is only worth a few kilobytes, so give it a moment.
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast('Checklist downloaded', { tone: 'info' })
    } catch {
      toast('The browser blocked the download', { tone: 'error', description: 'Use “Copy as text” or print instead.' })
    }
  }

  const merge = () => {
    if (!shared) return
    mergeSharedProject(shared)
    setMergedToken(params.get(SHARE_PARAM))
    toast('Saved to this device', { description: 'The shared project is now part of your own board.' })
  }

  // The quote form reads the board itself (colours, products and quantities),
  // so there is nothing to encode here beyond where the visitor came from.
  const quoteLink = '/quote?from=board'

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40" data-print="hide">
        <div className="shell py-10 sm:py-12">
          <Kicker className="mb-4">Your project</Kicker>
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              {/* A page needs one h1, and an editable field is not a heading:
                  the h1 names the page, the input underneath names the project. */}
              <h1 className="display text-[clamp(2rem,4.2vw,3.2rem)]">
                {shared && !alreadyMerged ? (
                  <>
                    A project <span className="italic">shared with you.</span>
                  </>
                ) : (
                  <>
                    Your project, <span className="italic">in order of work.</span>
                  </>
                )}
              </h1>
              <div className="mt-4 max-w-xl">
                <label htmlFor="project-name" className="kicker mb-1.5 block text-ink/72">
                  Project name
                </label>
                {shared && !alreadyMerged ? (
                  <input
                    id="project-name"
                    value={shared.name}
                    readOnly
                    className="w-full border-b border-ink/15 bg-transparent pb-1 font-[var(--font-display)] text-[1.5rem] text-ink/75 focus:outline-none"
                  />
                ) : (
                  <input
                    id="project-name"
                    value={board.boardName}
                    onChange={(event) => renameBoard(event.target.value)}
                    maxLength={60}
                    className="w-full border-b border-ink/15 bg-transparent pb-1 font-[var(--font-display)] text-[1.5rem] transition-colors hover:border-ink/35 focus:border-green focus:outline-none"
                  />
                )}
              </div>
              <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink/75">
                {shared && !alreadyMerged
                  ? 'Somebody shared this project with you. Everything below is read-only until you save it to this device.'
                  : 'Everything you saved on this device, in the order a job actually happens. Print it, share it, or send it to the colour desk as one enquiry.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {shared && !alreadyMerged ? (
                <Button size="sm" onClick={merge}>
                  <Layers className="size-4" aria-hidden /> Save to this device
                </Button>
              ) : null}
              <Button variant="paper" size="sm" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print
              </Button>
              <Button variant="paper" size="sm" onClick={copyText} disabled={!activeGroups.length}>
                <Copy className="size-4" aria-hidden /> Copy as text
              </Button>
              <Button variant="paper" size="sm" onClick={downloadText} disabled={!activeGroups.length}>
                <FileDown className="size-4" aria-hidden /> Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={shareLink}
                disabled={isEmpty || (Boolean(shared) && !alreadyMerged)}
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                {copied ? 'Link copied' : 'Share link'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {shared && !alreadyMerged ? (
        <div className="shell pt-6">
          <p className="rounded-sm border border-green/30 bg-green/5 px-4 py-3 text-[0.82rem] leading-relaxed text-ink/75">
            <span className="font-semibold text-ink">Shared project.</span> This link carries {shared.colours.length}{' '}
            colour{shared.colours.length === 1 ? '' : 's'}, {shared.products.length} product
            {shared.products.length === 1 ? '' : 's'} and {shared.estimates.length} quantity estimate
            {shared.estimates.length === 1 ? '' : 's'}. It is stored in the link itself, not on a server — nothing was
            sent to us when you opened it.
          </p>
        </div>
      ) : null}

      {!shared && isEmpty ? (
        <section className="shell py-10">
          <EmptyState
            title="Nothing saved yet"
            body="Bookmark colours, add products, save a quantity from the calculator and choose the preparation your walls need. This page turns all of it into the order of work."
            action={<ButtonLink to="/colours">Explore the colour library</ButtonLink>}
            icon={<ClipboardList className="size-8" aria-hidden />}
          />
          <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              { to: '/tools/finish-finder', label: 'Specify the finish' },
              { to: '/tools/surface-prep', label: 'Choose the preparation' },
              { to: '/calculator', label: 'Work out the quantities' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-sm border border-ink/12 bg-paper-2/60 px-4 py-3 text-center text-[0.82rem] font-semibold transition-colors hover:border-ink/35"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {(shared || !isEmpty) && (
        <div className="shell grid gap-8 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-12">
          {/* ------------------------------------------------------- checklist */}
          <div>
            <h2 className="display text-[clamp(1.6rem,3.2vw,2.3rem)]">The order of work</h2>
            <p className="mt-2 max-w-2xl text-[0.86rem] leading-relaxed text-ink/72">
              Ticking a box here is for the screen in front of you — the ticks are not saved. Print or download the list
              for the site.
            </p>

            <ol className="mt-5 space-y-6">
              {activeGroups.map((group, index) => (
                <li key={group.id}>
                  <section aria-labelledby={`group-${group.id}`}>
                    <h3 id={`group-${group.id}`} className="flex items-baseline gap-2.5">
                      <span className="tabular text-[0.68rem] font-bold tracking-[0.16em] text-ink/72">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="font-[var(--font-display)] text-[1.3rem]">{group.title}</span>
                    </h3>
                    {group.note ? <p className="mt-1 max-w-2xl text-[0.78rem] leading-relaxed text-ink/72">{group.note}</p> : null}
                    <ul className="mt-3 space-y-2">
                      {group.items.map((item) => {
                        const checked = Boolean(ticked[item.id])
                        return (
                          <li key={item.id}>
                            <label
                              className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors',
                                checked ? 'border-green/40 bg-green/5' : 'border-ink/12 bg-paper-2/60 hover:border-ink/30',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setTicked((current) => ({ ...current, [item.id]: !current[item.id] }))}
                                className="mt-0.5 size-4 shrink-0 accent-[var(--color-green)]"
                              />
                              <span className="min-w-0 flex-1">
                                <span className={cn('block text-[0.86rem] font-semibold', checked && 'text-ink/60 line-through')}>
                                  {item.label}
                                </span>
                                {item.detail ? (
                                  <span className="mt-0.5 block text-[0.78rem] leading-relaxed text-ink/72">{item.detail}</span>
                                ) : null}
                                {item.to ? (
                                  <Link
                                    to={item.to}
                                    className="mt-1 inline-block text-[0.72rem] font-bold uppercase tracking-[0.1em] text-green hover:underline"
                                  >
                                    Open
                                  </Link>
                                ) : null}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                </li>
              ))}
              {!activeGroups.length ? (
                <li>
                  <EmptyState
                    title="No checklist yet"
                    body="Save a colour, a product or a quantity and the checklist builds itself from the product data and the preparation sequences you chose."
                    action={<ButtonLink to="/tools" size="sm">Open the tools</ButtonLink>}
                  />
                </li>
              ) : null}
            </ol>
          </div>

          {/* ------------------------------------------------------------ board */}
          <aside className="space-y-4 lg:sticky lg:top-24" data-print="hide">
            <section aria-labelledby="saved-colours" className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
              <h3 id="saved-colours" className="kicker mb-3 text-ink/72">
                Colours on this project
              </h3>
              {shared && !alreadyMerged ? (
                <ul className="space-y-1.5">
                  {sharedColours.map((colour) => (
                    <li key={colour.id} className="flex items-center gap-2.5 text-[0.82rem]">
                      <span className="size-6 shrink-0 rounded-[3px] ring-1 ring-inset ring-black/10" style={{ background: colour.hex }} aria-hidden />
                      <Link to={`/colours/${colour.id}`} className="font-semibold hover:text-green">
                        {colour.name}
                      </Link>
                      <span className="text-[0.72rem] text-ink/72">{colour.code}</span>
                    </li>
                  ))}
                  {!sharedColours.length ? <li className="text-[0.8rem] text-ink/72">No colours in this shared link.</li> : null}
                </ul>
              ) : colours.length ? (
                <ul className="space-y-1.5">
                  {colours.map((colour) => (
                    <li key={colour.id} className="group flex items-center gap-2.5 text-[0.82rem]">
                      <span className="size-6 shrink-0 rounded-[3px] ring-1 ring-inset ring-black/10" style={{ background: colour.hex }} aria-hidden />
                      <Link to={`/colours/${colour.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-green">
                        {colour.name}
                      </Link>
                      <span className="shrink-0 text-[0.72rem] text-ink/72">{colour.code}</span>
                      <button
                        type="button"
                        onClick={() => removeColor(colour.id)}
                        aria-label={`Remove ${colour.name} from the project`}
                        className="grid size-7 shrink-0 place-items-center rounded-full text-ink/72 transition-colors hover:bg-crimson/10 hover:text-crimson"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[0.8rem] text-ink/72">
                  No colours saved yet.{' '}
                  <Link to="/colours" className="font-semibold text-green hover:underline">
                    Browse the library
                  </Link>{' '}
                  and bookmark the ones you like.
                </p>
              )}
            </section>

            <section aria-labelledby="saved-quantities" className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
              <h3 id="saved-quantities" className="kicker mb-3 text-ink/72">
                Quantities
              </h3>
              {shared && !alreadyMerged ? (
                <ul className="space-y-1.5">
                  {shared.estimates.map((estimate) => (
                    <li key={estimate.id} className="text-[0.82rem]">
                      <span className="font-semibold">{estimate.packs}</span>{' '}
                      <span className="text-ink/72">
                        {findProduct(estimate.productId)?.shortName ?? estimate.productId} · {estimate.label} ·{' '}
                        {estimate.area} m² · {estimate.coats} coats
                      </span>
                    </li>
                  ))}
                  {!shared.estimates.length ? <li className="text-[0.8rem] text-ink/72">No quantities in this shared link.</li> : null}
                </ul>
              ) : board.estimates.length ? (
                <ul className="space-y-1.5">
                  {board.estimates.map((estimate: SavedEstimate) => (
                    <li key={estimate.id} className="flex items-start gap-2 text-[0.82rem]">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{estimate.packs}</span>{' '}
                        <span className="text-ink/72">
                          {findProduct(estimate.productId)?.shortName ?? estimate.productId} · {estimate.label}
                        </span>
                        <span className="block text-[0.72rem] text-ink/72">
                          {estimate.area} m² · {estimate.coats} coat{estimate.coats === 1 ? '' : 's'} ·{' '}
                          {estimate.litres} {estimate.unit} required
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeEstimate(estimate.id)}
                        aria-label={`Remove the ${estimate.label} estimate`}
                        className="grid size-7 shrink-0 place-items-center rounded-full text-ink/72 transition-colors hover:bg-crimson/10 hover:text-crimson"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[0.8rem] text-ink/72">
                  Nothing sized yet.{' '}
                  <Link to="/calculator" className="font-semibold text-green hover:underline">
                    Use the calculator
                  </Link>{' '}
                  and save the estimate — it lands here and in the buy list.
                </p>
              )}
            </section>

            <section aria-labelledby="saved-prep" className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
              <h3 id="saved-prep" className="kicker mb-2 text-ink/72">
                Preparation on this project
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {PREP_SITUATIONS.map((situation) => {
                  const active = board.prep.includes(situation.id)
                  return (
                    <button
                      key={situation.id}
                      type="button"
                      onClick={() => togglePrep(situation.id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold transition-colors',
                        active
                          ? 'border-ink bg-ink text-paper-2'
                          : 'border-ink/15 text-ink/75 hover:border-ink/45 hover:text-ink',
                      )}
                    >
                      {situation.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-ink/72">
                Choosing a situation adds its full sequence to the checklist, in order.{' '}
                <Link to="/tools/surface-prep" className="font-semibold text-green hover:underline">
                  Compare them first
                </Link>
                .
              </p>
            </section>

            {products.length ? (
              <section aria-labelledby="saved-products" className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
                <h3 id="saved-products" className="kicker mb-3 text-ink/72">
                  Products
                </h3>
                <ul className="space-y-1.5">
                  {products.map((product) => (
                    <li key={product.id} className="flex items-center gap-2 text-[0.82rem]">
                      <Link to={`/products/${product.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-green">
                        {product.name}
                      </Link>
                      <Badge tone={product.claimsStatus === 'label-verified' ? 'green' : 'line'}>
                        {product.claimsStatus === 'label-verified' ? 'Label' : 'In review'}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => toggleProduct(product.id)}
                        aria-label={`Remove ${product.name} from the project`}
                        className="grid size-7 shrink-0 place-items-center rounded-full text-ink/72 transition-colors hover:bg-crimson/10 hover:text-crimson"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="space-y-2 rounded-sm bg-ink p-4 text-paper-2">
              <p className="font-[var(--font-display)] text-[1.15rem]">Send this to a person</p>
              <p className="text-[0.78rem] leading-relaxed text-paper-2/65">
                The quote form arrives with your colours, products and quantities attached, so the desk quotes the real
                job rather than asking you to describe it.
              </p>
              <ButtonLink to={quoteLink} size="sm" variant="paper" fullWidth>
                Request a quote for this project
              </ButtonLink>
              <ButtonLink
                to={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  `Hello OPUDA'S PAINT — ${activeName}: ${colours
                    .map((colour) => `${colour.name} (${colour.code})`)
                    .join(', ') || 'a project'}${
                    board.estimates.length
                      ? `. Quantities: ${board.estimates
                          .map((estimate) => `${estimate.packs} ${findProduct(estimate.productId)?.shortName ?? ''} for ${estimate.label}`)
                          .join('; ')}`
                      : ''
                  }. Please send pricing and stock.`,
                )}`}
                external
                size="sm"
                variant="outline"
                fullWidth
                className="justify-center border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
                onClick={() => track('cta_click', { target: 'whatsapp', source: 'project-checklist' })}
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp the list
              </ButtonLink>
            </div>

            {!shared && !isEmpty ? (
              <div className="flex items-center justify-between gap-3 rounded-sm border border-ink/12 px-4 py-3">
                <p className="text-[0.74rem] leading-relaxed text-ink/72">
                  Stored only in this browser. Clearing it does not delete anything on our side — nothing is sent until
                  you submit an enquiry.
                </p>
                <Button variant="ghost" size="sm" onClick={clearBoard}>
                  <Trash2 className="size-3.5" aria-hidden /> Clear
                </Button>
              </div>
            ) : null}

            <div>
              <ArrowLink to="/tools">Back to the tools</ArrowLink>
            </div>
            <p className="text-[0.72rem] leading-relaxed text-ink/72">
              Products in the range: {PRODUCTS.length}. Colours on screen are digital proofs — confirm with a sample pot
              or a dealer chip.
            </p>
          </aside>
        </div>
      )}

      <section className="shell pb-16" data-print="hide">
        <div className="rounded-sm border border-ink/12 bg-paper-2/50 p-5">
          <h2 className="text-[1.05rem] font-semibold">What a shared link contains</h2>
          <p className="mt-2 max-w-3xl text-[0.82rem] leading-relaxed text-ink/72">
            Colour codes, product codes, room labels, quantities and the preparation situations you chose — encoded in
            the link itself. No name, no phone number, no email, no account, and nothing stored on a server. Anyone with
            the link can read it, which is why it carries the project and not the person. Read the{' '}
            <Link to="/legal/privacy" className="font-semibold text-green hover:underline">
              privacy notice
            </Link>{' '}
            for what happens when you do submit an enquiry.
          </p>
        </div>
      </section>
    </>
  )
}
