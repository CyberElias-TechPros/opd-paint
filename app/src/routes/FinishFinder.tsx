import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ClipboardList, Info, MessageCircle, Ruler, TriangleAlert } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import {
  CONDITION_OPTIONS,
  FINISH_QUESTIONS,
  OPTIONS_FOR,
  SHEEN_OPTIONS,
  SURFACE_OPTIONS,
  WEAR_OPTIONS,
  type ConditionKey,
  type FinishAnswers,
  type SheenKey,
  type SurfaceKey,
  type WearKey,
} from '../data/tools'
import { recommendFinish } from '../lib/advisor'
import { findGuide } from '../data/guides'
import { Kicker, Badge, ArrowLink } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { useApp } from '../store/AppStore'
import { track } from '../lib/analytics'
import { cn } from '../lib/cn'
import { WHATSAPP_NUMBER } from '../data/dealers'

const STEPS = FINISH_QUESTIONS.map((question) => question.id)

const isSurface = (value: string | null): value is SurfaceKey =>
  SURFACE_OPTIONS.some((option) => option.id === value)
const isCondition = (value: string | null): value is ConditionKey =>
  CONDITION_OPTIONS.some((option) => option.id === value)
const isWear = (value: string | null): value is WearKey => WEAR_OPTIONS.some((option) => option.id === value)
const isSheen = (value: string | null): value is SheenKey => SHEEN_OPTIONS.some((option) => option.id === value)

/**
 * Finish finder (roadmap 11.02.01).
 *
 * A guided flow rather than a filter: one question at a time, the reason for
 * asking it on screen, and an answer that explains itself. The recommendation is
 * computed by a pure rule table in `lib/advisor.ts`, which is unit-tested — a
 * specification given to a customer has to be reproducible and defensible.
 *
 * Answers live in the query string, so a specification can be bookmarked, sent
 * to a painter, or come back to with the browser's back button.
 */
export default function FinishFinder() {
  const [params, setParams] = useSearchParams()
  const { toggleProduct, togglePrep, board, toast } = useApp()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [announced, setAnnounced] = useState('')

  const answers = useMemo(() => {
    const surface = params.get('surface')
    const condition = params.get('condition')
    const wear = params.get('wear')
    const sheen = params.get('sheen')
    return {
      surface: isSurface(surface) ? surface : null,
      condition: isCondition(condition) ? condition : null,
      wear: isWear(wear) ? wear : null,
      sheen: isSheen(sheen) ? sheen : null,
    }
  }, [params])

  const answered = STEPS.filter((step) => answers[step] !== null).length
  const complete = answered === STEPS.length
  const stepIndex = complete ? STEPS.length : STEPS.findIndex((step) => answers[step] === null)

  const advice = useMemo(() => {
    if (!complete) return null
    return recommendFinish(answers as unknown as FinishAnswers)
  }, [complete, answers])

  usePageMeta({
    title: 'Finish finder — which OPUDA’S product for your surface',
    description:
      'Four questions about the surface, its condition, the wear and the look you want, answered with a specified system: preparation, primer, topcoat, coats and drying times, with the reasoning shown.',
    path: '/tools/finish-finder',
    image: '/media/product-silk-bucket.webp',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'OPUDA’S PAINT finish finder',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      featureList: ['Finish selection by surface, condition, wear and sheen', 'Preparation sequence', 'Primer and topcoat specification'],
    },
  })

  useEffect(() => {
    if (answered > 0) track('tool_start', { tool: 'finish-finder', answered })
    // Only the first answer of a session is a "start"; repeats would inflate it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered === 1])

  useEffect(() => {
    if (!advice) return
    track('tool_complete', { tool: 'finish-finder', product: advice.blocked ? 'blocked' : advice.topcoat.id })
    setAnnounced(
      advice.blocked
        ? advice.blocked.title
        : `Recommended: ${advice.topcoat.name}. ${advice.coats} coats.`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advice?.topcoat.id, advice?.blocked?.title])

  const choose = (step: (typeof STEPS)[number], value: string) => {
    const next = new URLSearchParams(params)
    next.set(step, value)
    // A change of surface can invalidate nothing here, but a change of condition
    // can change the preparation advice entirely, so the query string is the
    // only state: reload the page from a link and you get the same answer.
    setParams(next, { replace: false })
  }

  const back = () => {
    const target = Math.max(0, (complete ? STEPS.length - 1 : stepIndex) - 1)
    const next = new URLSearchParams(params)
    for (const step of STEPS.slice(target + 1)) next.delete(step)
    setParams(next, { replace: true })
    headingRef.current?.focus()
  }

  const restart = () => {
    setParams({}, { replace: true })
    headingRef.current?.focus()
  }

  const saveSpecification = () => {
    if (!advice || advice.blocked) return
    toggleProduct(advice.topcoat.id)
    if (advice.primer) toggleProduct(advice.primer.id)
    if (advice.screed) toggleProduct(advice.screed.id)
    for (const situation of advice.prep) {
      if (!board.prep.includes(situation.id)) togglePrep(situation.id)
    }
    toast('Specification added to your project', {
      description: 'Open your project board for the checklist, or share it as a link.',
    })
  }

  const savedAlready = advice ? board.savedProducts.includes(advice.topcoat.id) : false

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-12">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] text-ink/72">
              <li>
                <Link to="/tools" className="hover:text-ink">
                  Tools
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-semibold text-ink/70">
                Finish finder
              </li>
            </ol>
          </nav>
          <Kicker className="mb-4">Finish finder</Kicker>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="display max-w-3xl text-[clamp(2.1rem,4.4vw,3.4rem)] focus:outline-none"
          >
            Which finish belongs on <span className="italic">this surface?</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/75">
            Four questions. The answer is a specified system — preparation, primer, topcoat, coats and drying times —
            with the reasoning shown, so you can argue with it. Nothing here is a price: for that, send the
            specification to a dealer or to the colour desk.
          </p>
        </div>
      </header>

      <div className="shell grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-start lg:gap-12">
        {/* ------------------------------------------------------------ questions */}
        <div>
          <div className="mb-6">
            <div className="flex items-center justify-between text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink/72">
              <span>
                {complete ? 'All four answered' : `Question ${stepIndex + 1} of ${STEPS.length}`}
              </span>
              <span className="tabular">{answered}/{STEPS.length}</span>
            </div>
            <div className="mt-2 flex h-1.5 gap-1" role="presentation">
              {STEPS.map((step, index) => (
                <span
                  key={step}
                  className={cn(
                    'flex-1 rounded-full transition-colors duration-300',
                    answers[step] !== null ? 'bg-green' : index === stepIndex ? 'bg-ink/35' : 'bg-ink/12',
                  )}
                />
              ))}
            </div>
          </div>

          <ol className="space-y-4">
            {FINISH_QUESTIONS.map((question, index) => {
              const value = answers[question.id]
              const isCurrent = index === stepIndex && !complete
              const options = OPTIONS_FOR[question.id]
              const answeredAlready = value !== null
              return (
                <li
                  key={question.id}
                  className={cn(
                    'rounded-sm border p-4 transition-colors sm:p-5',
                    isCurrent ? 'border-ink bg-paper-2/80' : answeredAlready ? 'border-ink/15 bg-paper-2/40' : 'border-ink/10 bg-paper-2/20',
                  )}
                >
                  {/* Every question stays editable: changing an answer earlier
                      in the flow is the normal way to use a guided tool, and a
                      disabled control is a dead end for a keyboard user. */}
                  <fieldset>
                    <legend className="w-full">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="tabular text-[0.66rem] font-bold tracking-[0.16em] text-ink/72">
                          {question.step}
                        </span>
                        <span className="font-[var(--font-display)] text-[1.25rem] leading-tight">{question.prompt}</span>
                        {answeredAlready ? (
                          <Badge tone="green">
                            <Check className="size-2.5" aria-hidden /> Answered
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-1.5 flex items-start gap-1.5 text-[0.76rem] leading-relaxed text-ink/72">
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {question.why}
                      </span>
                    </legend>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {options.map((option) => {
                        const checked = value === option.id
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              'flex cursor-pointer items-start gap-2.5 rounded-[3px] border p-3 text-left transition-colors',
                              checked
                                ? 'border-ink bg-white/80 ring-1 ring-ink'
                                : 'border-ink/12 bg-white/40 hover:border-ink/40',
                              // Not `opacity-55`: fading the whole label took the
                              // option text to 3.97:1 and its note to 2.55:1, both
                              // under AA. A dashed border and no fill say "not
                              // reached yet" while the text keeps its contrast.
                              !isCurrent && !answeredAlready ? 'border-dashed border-ink/15 bg-transparent' : undefined,
                            )}
                          >
                            <input
                              type="radio"
                              name={`finish-${question.id}`}
                              value={option.id}
                              checked={checked}
                              onChange={() => choose(question.id, option.id)}
                              className="mt-1 size-4 shrink-0 accent-[var(--color-green)]"
                            />
                            <span className="min-w-0">
                              <span className="block text-[0.86rem] font-semibold">{option.label}</span>
                              <span className="mt-0.5 block text-[0.74rem] leading-relaxed text-ink/72">
                                {option.note}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>

                  {isCurrent && index > 0 ? (
                    <button
                      type="button"
                      onClick={back}
                      className="mt-3 inline-flex items-center gap-1.5 text-[0.74rem] font-semibold text-ink/72 hover:text-ink"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden /> Back a question
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ol>

          {complete ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={restart}>
                Start again
              </Button>
              <Button variant="ghost" size="sm" onClick={back}>
                <ArrowLeft className="size-3.5" aria-hidden /> Change an answer
              </Button>
            </div>
          ) : null}
        </div>

        {/* --------------------------------------------------------------- answer */}
        <div className="lg:sticky lg:top-24">
          <p aria-live="polite" className="sr-only">
            {announced}
          </p>

          {!complete ? (
            <div className="rounded-sm border border-dashed border-ink/20 bg-paper-2/50 p-5 text-center">
              <p className="font-[var(--font-display)] text-[1.2rem]">
                {answered === 0 ? 'Answer the first question' : `${STEPS.length - answered} to go`}
              </p>
              <p className="mx-auto mt-2 max-w-xs text-[0.8rem] leading-relaxed text-ink/72">
                The specification appears here as soon as all four are answered. You can change any answer afterwards and
                it recalculates.
              </p>
            </div>
          ) : null}

          {advice?.blocked ? (
            <div className="overflow-hidden rounded-sm border border-crimson/40 bg-crimson/5">
              <div className="border-b border-crimson/25 px-5 py-4">
                <p className="flex items-center gap-2 text-[0.86rem] font-bold text-crimson">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {advice.blocked.title}
                </p>
              </div>
              <div className="space-y-4 px-5 py-5">
                <p className="text-[0.86rem] leading-relaxed text-ink/75">{advice.blocked.body}</p>
                <ButtonLink to={`/advice/${advice.blocked.guideId}`} variant="crimson" size="sm" fullWidth>
                  Read the damp and mould guide
                </ButtonLink>
                <ButtonLink to={`/tools/surface-prep?situation=damp`} variant="outline" size="sm" fullWidth>
                  Open the damp preparation sequence
                </ButtonLink>
              </div>
            </div>
          ) : null}

          {advice && !advice.blocked ? (
            <div className="overflow-hidden rounded-sm border border-ink bg-ink text-paper-2 shadow-[0_40px_80px_-50px_rgba(11,26,19,0.8)]">
              <div className="border-b border-paper-2/12 px-5 py-4">
                <p className="kicker text-paper-2/65">Your specification</p>
                <p className="mt-1 font-[var(--font-display)] text-[1.4rem] leading-tight">{advice.topcoat.name}</p>
                <p className="mt-1 text-[0.78rem] text-paper-2/65">
                  {advice.sheenLabel} · {advice.coats} coat{advice.coats === 1 ? '' : 's'} ·{' '}
                  {advice.topcoat.coveragePerUnit} m² per {advice.topcoat.packs[0]?.unit === 'kg' ? 'kg' : 'L'} per coat
                </p>
                <p className="mt-2">
                  {/* The `green` tone is dark green on a light wash; inside this
                      ink panel it measured 2.59:1. `paper` passes on both, and the
                      distinction is carried by the words and the icon rather than
                      by colour alone. */}
                  <Badge tone="paper">
                    {advice.topcoat.claimsStatus === 'label-verified' ? (
                      <Check className="size-2.5" aria-hidden />
                    ) : (
                      <Info className="size-2.5" aria-hidden />
                    )}
                    {advice.topcoat.claimsStatus === 'label-verified' ? 'Claims from the label' : 'Specification in review'}
                  </Badge>
                </p>
              </div>

              <div className="space-y-5 px-5 py-5">
                <section aria-labelledby="system-title">
                  <h2 id="system-title" className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper-2/65">
                    The system, in order
                  </h2>
                  <ol className="mt-2 space-y-2">
                    {advice.screed ? (
                      <li className="flex gap-2.5 text-[0.84rem]">
                        <span className="tabular mt-0.5 shrink-0 text-paper-2/50">1</span>
                        <span>
                          <Link to={`/products/${advice.screed.id}`} className="font-semibold underline decoration-paper-2/30 hover:decoration-paper-2">
                            {advice.screed.name}
                          </Link>
                          <span className="block text-[0.76rem] text-paper-2/65">
                            Two thin passes to flatten the surface, sanded at 120 grit between.
                          </span>
                        </span>
                      </li>
                    ) : null}
                    {advice.primer || advice.primerNote ? (
                      <li className="flex gap-2.5 text-[0.84rem]">
                        <span className="tabular mt-0.5 shrink-0 text-paper-2/50">{advice.screed ? 2 : 1}</span>
                        <span>
                          {advice.primer ? (
                            <Link
                              to={`/products/${advice.primer.id}`}
                              className="font-semibold underline decoration-paper-2/30 hover:decoration-paper-2"
                            >
                              {advice.primer.name}
                            </Link>
                          ) : (
                            <span className="font-semibold">{advice.primerNote}</span>
                          )}
                          <span className="block text-[0.76rem] text-paper-2/65">
                            {advice.primer
                              ? `One coat, recoat after ${advice.primer.recoatHours} hours.`
                              : 'Not part of this range — ask the desk for a substrate-appropriate primer.'}
                          </span>
                        </span>
                      </li>
                    ) : null}
                    <li className="flex gap-2.5 text-[0.84rem]">
                      <span className="tabular mt-0.5 shrink-0 text-paper-2/50">
                        {(advice.screed ? 1 : 0) + (advice.primer || advice.primerNote ? 1 : 0) + 1}
                      </span>
                      <span>
                        <Link
                          to={`/products/${advice.topcoat.id}`}
                          className="font-semibold underline decoration-paper-2/30 hover:decoration-paper-2"
                        >
                          {advice.topcoat.name}
                        </Link>
                        <span className="block text-[0.76rem] text-paper-2/65">
                          {advice.coats} coats · touch dry {advice.topcoat.touchDryHours} h · recoat{' '}
                          {advice.topcoat.recoatHours} h · full cure {advice.topcoat.fullCureDays} days
                        </span>
                      </span>
                    </li>
                  </ol>
                  {advice.coatsNote ? (
                    <p className="mt-2 text-[0.76rem] leading-relaxed text-paper-2/70">{advice.coatsNote}</p>
                  ) : null}
                </section>

                <section aria-labelledby="why-title">
                  <h2 id="why-title" className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper-2/65">
                    Why this answer
                  </h2>
                  <ul className="mt-2 space-y-1.5">
                    {advice.reasons.map((reason) => (
                      <li key={reason} className="flex gap-2 text-[0.8rem] leading-relaxed text-paper-2/75">
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-green-bright" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </section>

                {advice.cautions.length ? (
                  <section aria-labelledby="caution-title">
                    <h2 id="caution-title" className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper-2/65">
                      Read this before you start
                    </h2>
                    <ul className="mt-2 space-y-2">
                      {advice.cautions.map((caution) => (
                        <li
                          key={caution.text}
                          className="rounded-[3px] border border-paper-2/20 bg-paper-2/8 px-3 py-2.5 text-[0.78rem] leading-relaxed text-paper-2/80"
                        >
                          {caution.text}
                          {caution.guideId && findGuide(caution.guideId) ? (
                            <Link
                              to={`/advice/${caution.guideId}`}
                              className="mt-1 block text-[0.72rem] font-bold uppercase tracking-[0.1em] text-green-mist hover:underline"
                            >
                              {findGuide(caution.guideId)?.title}
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {advice.prep.length ? (
                  <section aria-labelledby="prep-title">
                    <h2 id="prep-title" className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-paper-2/65">
                      Preparation sequence
                    </h2>
                    <ul className="mt-2 space-y-1.5">
                      {advice.prep.map((situation) => (
                        <li key={situation.id}>
                          <Link
                            to={`/tools/surface-prep?situation=${situation.id}`}
                            className="flex items-center justify-between gap-3 rounded-[3px] border border-paper-2/20 px-3 py-2 text-[0.8rem] hover:border-paper-2/50"
                          >
                            {situation.label}
                            <ArrowRight className="size-3.5 shrink-0 text-paper-2/60" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <div className="space-y-2 border-t border-paper-2/12 pt-4">
                  <Button
                    variant="paper"
                    size="sm"
                    fullWidth
                    onClick={saveSpecification}
                    aria-pressed={savedAlready}
                  >
                    <ClipboardList className="size-4" aria-hidden />
                    {savedAlready ? 'Update this in my project' : 'Save this specification to my project'}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <ButtonLink
                      to={`/calculator?product=${advice.topcoat.id}`}
                      size="sm"
                      variant="outline"
                      className="justify-center border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
                    >
                      <Ruler className="size-3.5" aria-hidden /> Size the job
                    </ButtonLink>
                    <ButtonLink
                      to={`/project`}
                      size="sm"
                      variant="outline"
                      className="justify-center border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
                    >
                      <ClipboardList className="size-3.5" aria-hidden /> Checklist
                    </ButtonLink>
                  </div>
                  <ButtonLink
                    to={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                      `Hello OPUDA'S PAINT, the finish finder specified ${advice.topcoat.name} (${advice.topcoat.sku}), ${advice.coats} coats${
                        advice.primer ? `, with ${advice.primer.name}` : ''
                      }. Please send pricing and stock.`,
                    )}`}
                    external
                    size="sm"
                    variant="outline"
                    fullWidth
                    className="justify-center border-paper-2/30 text-paper-2 hover:bg-paper-2 hover:text-ink"
                    onClick={() => track('cta_click', { target: 'whatsapp', source: 'finish-finder' })}
                  >
                    <MessageCircle className="size-3.5" aria-hidden /> WhatsApp this specification
                  </ButtonLink>
                </div>

                {advice.alternative ? (
                  <p className="text-[0.76rem] leading-relaxed text-paper-2/65">
                    The alternative, if you disagree:{' '}
                    <Link to={`/products/${advice.alternative.id}`} className="font-semibold text-paper-2 underline decoration-paper-2/40">
                      {advice.alternative.name}
                    </Link>{' '}
                    — {advice.alternative.bestFor}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-3">
              <p className="text-[0.76rem] leading-relaxed text-ink/72">
                <span className="font-semibold text-ink">This is a specification, not a guarantee of appearance.</span>{' '}
                Colour changes with finish: a deep colour looks darker in matt and richer in silk. Approve the actual
                product on the actual wall before the whole room is coated.
              </p>
            </div>
            <ArrowLink to="/advice/matt-or-silk">Matt or silk, in full</ArrowLink>
          </div>
        </div>
      </div>
    </>
  )
}
