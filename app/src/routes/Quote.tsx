import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, MessageCircle, Phone, ShieldCheck, TriangleAlert } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { useApp } from '../store/AppStore'
import { colorsByIds } from '../data/colors'
import { PRODUCTS } from '../data/products'
import { BRAND_PHONE_DISPLAY, BRAND_PHONE_TEL, WHATSAPP_NUMBER } from '../data/dealers'
import { Button, ButtonLink } from '../components/ui/Button'
import { Checkbox, Field, Select, TextArea, TextInput } from '../components/ui/Field'
import { Kicker, Badge, ArrowLink } from '../components/ui/Bits'
import { ApiFieldError, submitQuote, stashFailedSubmission, type QuoteResponse } from '../lib/api'
import { track } from '../lib/analytics'

const PROJECT_TYPES = [
  { value: 'interior-whole', label: 'Whole interior' },
  { value: 'interior-room', label: 'One or two rooms' },
  { value: 'exterior', label: 'Exterior / facade' },
  { value: 'new-build', label: 'New build or first decoration' },
  { value: 'trade', label: 'Trade, contract or bulk' },
  { value: 'sample', label: 'Sample pots / colour chips' },
  { value: 'dealer', label: 'Dealer or distributor enquiry' },
  { value: 'other', label: 'Something else' },
]

type Errors = Record<string, string>

export default function Quote() {
  const [params] = useSearchParams()
  const { board, toast } = useApp()
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [errors, setErrors] = useState<Errors>({})
  const [response, setResponse] = useState<QuoteResponse | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const preselectedColours = useMemo(() => {
    const fromParam = (params.get('colours') ?? '').split(',').filter(Boolean)
    const fromBoard = params.get('from') === 'board' || params.get('from') === 'compare' ? board.savedColors : []
    const single = params.get('colour') ? [params.get('colour') as string] : []
    return [...new Set([...single, ...fromParam, ...fromBoard])]
  }, [params, board.savedColors])

  const colours = colorsByIds(preselectedColours)
  const products = board.savedProducts
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter((p): p is (typeof PRODUCTS)[number] => Boolean(p))

  usePageMeta({
    title: 'Request a quote or colour consultation',
    description:
      'Tell OPUDA’S PAINT about your project and get a specification, a colour scheme or a quotation. We reply with the products, quantities and next steps — normally within one working day.',
    path: '/quote',
    image: '/media/project-porch-blue.webp',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Request a quote — OPUDA’S PAINT',
      url: 'https://opudapaint.com/quote',
    },
  })

  const validate = (data: FormData): Errors => {
    const next: Errors = {}
    const name = String(data.get('name') ?? '').trim()
    const phone = String(data.get('phone') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const city = String(data.get('city') ?? '').trim()
    const projectType = String(data.get('projectType') ?? '')
    const consent = data.get('consent')

    if (name.length < 2) next.name = 'Please give us a name to reply to.'
    const digits = phone.replace(/[^\d]/g, '')
    if (digits.length < 7) next.phone = 'Enter a phone number we can reach you on.'
    else if (digits.length > 15) next.phone = 'That number looks too long — check the country code.'
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) next.email = 'That email address looks incomplete.'
    if (city.length < 2) next.city = 'Which city or area is the project in?'
    if (!projectType) next.projectType = 'Choose the closest project type.'
    if (!consent) next.consent = 'We need your agreement before we can store and reply to your enquiry.'
    return next
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const found = validate(data)
    setErrors(found)
    if (Object.keys(found).length) {
      track('form_validation_error', { fields: Object.keys(found).join(',') })
      const firstField = Object.keys(found)[0]
      form.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus()
      return
    }

    setState('sending')
    setFailure(null)
    track('form_start', { source: 'quote' })

    const payload = {
      name: String(data.get('name')).trim(),
      phone: String(data.get('phone')).trim(),
      email: String(data.get('email') ?? '').trim() || undefined,
      city: String(data.get('city')).trim(),
      projectType: String(data.get('projectType')),
      rooms: String(data.get('rooms') ?? '').trim() || undefined,
      message: String(data.get('message') ?? '').trim() || undefined,
      colors: colours.map((c) => c.code),
      products: products.map((p) => p.sku),
      consent: true,
      company: String(data.get('company') ?? ''),
      source: params.get('from') ?? 'quote-page',
    }

    try {
      const result = await submitQuote(payload)
      setResponse(result)
      setState('done')
      track('quote_success', { projectType: payload.projectType })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      // The server rejected specific fields: show them where they belong and
      // keep the visitor's typing, rather than asking them to start again.
      if (error instanceof ApiFieldError) {
        setErrors(error.fields as Errors)
        setState('idle')
        setFailure(error.message)
        const firstField = Object.keys(error.fields)[0]
        form.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus()
        track('form_validation_error', { fields: Object.keys(error.fields).join(',') })
        return
      }
      stashFailedSubmission('quote', payload)
      setState('idle')
      setFailure(
        error instanceof Error && error.message
          ? `${error.message} Your details are saved on this device, so nothing is lost.`
          : 'We could not reach the server. Your details are saved on this device.',
      )
      track('quote_failure', { projectType: payload.projectType })
      toast('Submission failed', { tone: 'error', description: 'Your details are kept in this browser — try again or call us.' })
    }
  }

  if (state === 'done' && response) {
    return (
      <section className="shell max-w-3xl py-16 sm:py-24">
        <div className="rounded-sm border border-green/30 bg-green/5 p-6 sm:p-10">
          <span className="grid size-12 place-items-center rounded-full bg-green text-paper-2">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <h1 className="display mt-5 text-[clamp(1.9rem,4vw,2.8rem)]">Received. We will come back to you.</h1>
          <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink/70">
            Your enquiry is with the colour desk. Keep this reference — it is how we find your file if you call.
          </p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-ink/12 bg-paper-2 p-4">
              <dt className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink/72">Reference</dt>
              <dd className="tabular mt-1 text-[1.1rem] font-semibold">{response.reference}</dd>
            </div>
            <div className="rounded-sm border border-ink/12 bg-paper-2 p-4">
              <dt className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink/72">Routed to</dt>
              <dd className="mt-1 text-[0.92rem] font-semibold">{response.routedTo}</dd>
            </div>
          </dl>
          <ul className="mt-6 space-y-2 text-[0.88rem] text-ink/70">
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
              We aim to reply within {response.slaHours} working hours. If it is urgent, call and quote your reference.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
              Your details are used only to answer this enquiry. They are not added to marketing lists without a
              separate opt-in.
            </li>
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink to={`tel:${BRAND_PHONE_TEL}`} external>
              <Phone className="size-4" aria-hidden /> {BRAND_PHONE_DISPLAY}
            </ButtonLink>
            <ButtonLink to="/colours" variant="outline">
              Keep exploring colours
            </ButtonLink>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Talk to us</Kicker>
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <h1 className="display text-[clamp(2.2rem,4.6vw,3.6rem)]">
                Send us the room. <span className="italic">We will send back a scheme.</span>
              </h1>
              <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink/75">
                Dimensions, photographs, the light it gets and how you want the space to feel. We reply with two or three
                options, the products to use, and the litres you will need.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={`tel:${BRAND_PHONE_TEL}`} external variant="outline" size="sm">
                <Phone className="size-3.5" aria-hidden /> Call
              </ButtonLink>
              <ButtonLink to={`https://wa.me/${WHATSAPP_NUMBER}`} external variant="outline" size="sm">
                <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
              </ButtonLink>
            </div>
          </div>
        </div>
      </header>

      <div className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-14">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <input type="hidden" name="company" value="" aria-hidden tabIndex={-1} autoComplete="off" />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name" required error={errors.name}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  name="name"
                  autoComplete="name"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  placeholder="Adeola Bakare"
                />
              )}
            </Field>
            <Field label="Phone or WhatsApp" required error={errors.phone} hint="We reply on WhatsApp unless you ask otherwise.">
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  placeholder="0803 000 0000"
                />
              )}
            </Field>
            <Field label="Email" error={errors.email} hint="Optional — useful for drawings and longer replies.">
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  placeholder="you@example.com"
                />
              )}
            </Field>
            <Field label="City or area" required error={errors.city}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  name="city"
                  autoComplete="address-level2"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  placeholder="GRA Phase 2, Port Harcourt"
                />
              )}
            </Field>
            <Field label="Project type" required error={errors.projectType}>
              {({ id, describedBy, invalid }) => (
                <Select id={id} name="projectType" aria-invalid={invalid} aria-describedby={describedBy} defaultValue={params.get('type') === 'trade' ? 'trade' : params.get('type') === 'sample' ? 'sample' : params.get('type') === 'dealer' ? 'dealer' : ''}>
                  <option value="">Choose one…</option>
                  {PROJECT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Rooms and approximate size" hint="For example: 3 bedrooms, a lounge and a corridor, about 320 m² of wall.">
              {({ id, describedBy }) => (
                <TextInput id={id} name="rooms" aria-describedby={describedBy} placeholder="3 bedrooms + lounge" />
              )}
            </Field>
          </div>

          <Field
            label="Anything else we should know"
            hint="Photographs are easiest to send on WhatsApp — tell us here and we will send you the number to use."
          >
            {({ id, describedBy }) => (
              <TextArea
                id={id}
                name="message"
                rows={5}
                aria-describedby={describedBy}
                placeholder="The walls are new render, finished three weeks ago. We want a warm neutral for the whole flat, with one deeper wall in the lounge."
              />
            )}
          </Field>

          {colours.length ? (
            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
              <p className="kicker mb-2 text-ink/72">Colours attached to this enquiry</p>
              <ul className="flex flex-wrap gap-2">
                {colours.map((colour) => (
                  <li key={colour.id} className="flex items-center gap-2 rounded-full border border-ink/12 bg-white/60 py-1 pl-1 pr-3">
                    <span className="size-6 rounded-full ring-1 ring-inset ring-black/10" style={{ background: colour.hex }} aria-hidden />
                    <span className="text-[0.76rem] font-semibold">{colour.name}</span>
                    <span className="text-[0.68rem] text-ink/72">{colour.code}</span>
                  </li>
                ))}
              </ul>
              <Link to="/colours" className="mt-2 inline-block text-[0.72rem] font-semibold text-green hover:underline">
                Add or change colours
              </Link>
            </div>
          ) : (
            <p className="rounded-sm border border-dashed border-ink/20 px-4 py-3 text-[0.8rem] text-ink/72">
              No colours attached yet. That is fine —{' '}
              <Link to="/colours" className="font-semibold text-green hover:underline">
                browse the library
              </Link>{' '}
              and bookmark the ones you like, and they will be attached automatically.
            </p>
          )}

          <Field label="Consent" required error={errors.consent} labelAs="span">
            {({ id, describedBy, invalid }) => (
              <div>
                <Checkbox
                  id={id}
                  name="consent"
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  label={
                    <>
                      I agree that OPUDA’S PAINT may use these details to reply to my enquiry, as described in the{' '}
                      <Link to="/legal/privacy" className="underline hover:text-green">
                        privacy notice
                      </Link>
                      .
                    </>
                  }
                  description="We do not sell or share your details. We do not add you to marketing lists without a separate opt-in."
                />
              </div>
            )}
          </Field>

          {failure ? (
            <div role="alert" className="flex items-start gap-2 rounded-sm border border-crimson/30 bg-crimson/5 p-3 text-[0.82rem] text-crimson">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {failure} You can also call{' '}
                <a href={`tel:${BRAND_PHONE_TEL}`} className="underline">
                  {BRAND_PHONE_DISPLAY}
                </a>{' '}
                or message us on WhatsApp.
              </span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send enquiry'}
            </Button>
            <p className="text-[0.74rem] text-ink/72">No account needed. We reply within one working day.</p>
          </div>
        </form>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <Badge tone="green">What happens next</Badge>
            <ol className="mt-3 space-y-3">
              {[
                'We read the enquiry and check it against the colour library and product range.',
                'A colour advisor replies with options, quantities and the nearest dealer with stock.',
                'If you want a site visit or a formal quotation, we arrange it in the same thread.',
              ].map((step, index) => (
                <li key={step} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-green/10 text-[0.6rem] font-bold text-green">
                    {index + 1}
                  </span>
                  <span className="text-[0.82rem] leading-relaxed text-ink/75">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {products.length ? (
            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <p className="kicker mb-2 text-ink/72">Products on your board</p>
              <ul className="space-y-1.5">
                {products.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-2 text-[0.82rem]">
                    <span className="font-semibold">{product.shortName}</span>
                    <span className="text-ink/72">{product.finish}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-sm bg-ink p-5 text-paper-2">
            <p className="font-[var(--font-display)] text-[1.15rem]">In a hurry?</p>
            <p className="mt-1 text-[0.8rem] leading-relaxed text-paper-2/60">
              Call the colour desk directly. Have the room dimensions and the colour code if you have one — it saves a
              round trip.
            </p>
            <a
              href={`tel:${BRAND_PHONE_TEL}`}
              className="mt-3 inline-flex items-center gap-2 rounded-[3px] bg-paper-2 px-4 py-2.5 text-[0.82rem] font-bold text-ink transition-colors hover:bg-green-bright hover:text-paper-2"
            >
              <Phone className="size-4" aria-hidden /> {BRAND_PHONE_DISPLAY}
            </a>
            <p className="mt-2 text-[0.7rem] text-paper-2/65">Monday to Saturday, 8am – 6pm</p>
          </div>

          <ArrowLink to="/calculator">Work out quantities first</ArrowLink>
        </aside>
      </div>
    </>
  )
}
