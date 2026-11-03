/**
 * Data-subject request intake — roadmap 16.03.07, NDPA sections 30–36.
 *
 * The privacy notice has always promised that a visitor can ask to see, correct
 * or delete what we hold, and get an answer within 30 days. Until now the only
 * way to ask was to write an email, which means the request lands in a mailbox
 * with no reference, no deadline and nobody accountable for the clock.
 *
 * This form posts to `POST /api/privacy`, which stores the request, gives it a
 * `DSAR-` reference, states the deadline, and announces it to the desk through
 * the same channels an enquiry uses. The failure path is the interesting one: if
 * the service cannot be reached the visitor is told to write to
 * hello@opudapaint.com instead, and told plainly that the 30 days starts when
 * they write — because a form that fails silently turns a statutory right into a
 * lost email.
 */
import { useState, type FormEvent } from 'react'
import { CheckCircle2, Mail, Phone } from 'lucide-react'
import {
  ApiFieldError,
  DATA_RIGHTS,
  submitPrivacyRequest,
  type DataRight,
  type PrivacyRequestResponse,
} from '../../lib/api'
import { Field, TextArea, TextInput } from '../ui/Field'
import { Button } from '../ui/Button'
import { useApp } from '../../store/AppStore'
import { track } from '../../lib/analytics'
import { BRAND_PHONE_DISPLAY } from '../../data/dealers'

type Errors = Record<string, string>

/** A courtesy check. The server decides what is acceptable, and says why. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

const longDate = (iso: string) => {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function DataRequestForm() {
  const { toast } = useApp()
  const [right, setRight] = useState<DataRight>('access')
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<PrivacyRequestResponse | null>(null)

  if (response) {
    return (
      <div
        data-testid="data-request-done"
        className="rounded-sm border border-green/30 bg-green/5 p-5 sm:p-6"
        role="status"
      >
        <span className="grid size-10 place-items-center rounded-full bg-green text-paper-2">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <h3 className="mt-4 font-[var(--font-display)] text-[1.3rem]">Your request is logged.</h3>
        <p className="mt-2 max-w-prose text-[0.92rem] leading-relaxed text-ink/72">
          It has a reference and a deadline now, and both are below. Answering it may mean confirming who you are
          first — that is not obstruction, it is how we avoid handing your data to somebody else.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-ink/12 bg-paper-2 p-3">
            <dt className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink/72">Reference</dt>
            <dd className="tabular mt-1 text-[1.05rem] font-semibold">{response.reference}</dd>
          </div>
          <div className="rounded-sm border border-ink/12 bg-paper-2 p-3">
            <dt className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink/72">Answer by</dt>
            <dd className="tabular mt-1 text-[1.05rem] font-semibold">{longDate(response.dueBy)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[0.84rem] leading-relaxed text-ink/72">
          Nothing further will be sent to your address because of this request. If the deadline passes without an
          answer, you may complain to the Nigeria Data Protection Commission — and we would rather you called{' '}
          {BRAND_PHONE_DISPLAY} first.
        </p>
      </div>
    )
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '').trim()
    const enquiryReference = String(data.get('enquiryReference') ?? '').trim()
    const note = String(data.get('note') ?? '').trim()
    const company = String(data.get('company') ?? '')

    const found: Errors = {}
    if (!EMAIL.test(email)) found.email = 'Enter an email address we can answer at, for example name@example.com.'
    if (note.length > 2000) found.note = 'That is longer than 2,000 characters. The short version is enough to start.'
    setErrors(found)
    if (Object.keys(found).length) {
      setFailure(null)
      track('form_validation_error', { fields: Object.keys(found).join(','), form: 'data-request' })
      form.querySelector<HTMLElement>(`[name="${Object.keys(found)[0]}"]`)?.focus()
      return
    }

    setSending(true)
    setFailure(null)
    track('privacy_request_submit', { right })

    try {
      const result = await submitPrivacyRequest({
        type: right,
        email,
        enquiryReference: enquiryReference || undefined,
        note: note || undefined,
        company,
        source: 'privacy-notice',
      })
      setResponse(result)
      track('privacy_request_success', { right })
      form.reset()
    } catch (error) {
      setSending(false)
      if (error instanceof ApiFieldError) {
        setErrors(error.fields as Errors)
        setFailure(error.message)
        track('form_validation_error', { fields: Object.keys(error.fields).join(','), form: 'data-request' })
        return
      }
      // The honest fallback. A right that can only be exercised through a form
      // that is currently broken is not a right.
      setFailure(
        'We could not send that just now. Write to hello@opudapaint.com or call ' +
          `${BRAND_PHONE_DISPLAY} instead — the 30 days starts when you write, not when this form works.`,
      )
      track('privacy_request_failure', { right })
      toast('Request not sent', {
        tone: 'error',
        description: 'Email hello@opudapaint.com and quote what you asked for — the clock starts when you write.',
      })
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-sm border border-ink/12 bg-paper-2/70 p-5 sm:p-6">
      <h3 className="font-[var(--font-display)] text-[1.3rem]">Ask us about your data</h3>
      <p className="mt-2 max-w-prose text-[0.9rem] leading-relaxed text-ink/72">
        This goes to the same place an email would, with a reference attached so it cannot be quietly dropped. We
        answer within 30 days.
      </p>

      {/* The same trap the enquiry form uses: a field no person can fill. */}
      <input type="hidden" name="company" value="" aria-hidden tabIndex={-1} autoComplete="off" />

      <fieldset className="mt-5">
        <legend className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink/72">What are you asking for?</legend>
        <div className="mt-3 grid gap-2">
          {DATA_RIGHTS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-sm border p-3 transition-colors ${
                right === option.value ? 'border-green bg-green/6' : 'border-ink/12 hover:border-ink/30'
              }`}
            >
              <input
                type="radio"
                name="right"
                value={option.value}
                checked={right === option.value}
                onChange={() => setRight(option.value)}
                className="mt-1 size-4 shrink-0 accent-[var(--color-green-deep,#0c6b45)]"
              />
              <span>
                <span className="block text-[0.9rem] font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[0.82rem] leading-relaxed text-ink/72">{option.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Email we should answer at" required error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required
            />
          )}
        </Field>
        <Field
          label="Enquiry reference"
          hint="If this is about an enquiry you already sent, its reference is in the confirmation — OPD-…"
          error={errors.enquiryReference}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="enquiryReference"
              placeholder="OPD-260101-1A2B"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </div>

      <Field
        className="mt-4"
        label="Anything we should know"
        hint="Optional. Which enquiry, which address, what is wrong — a sentence is enough to start."
        error={errors.note}
      >
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            name="note"
            rows={4}
            maxLength={2000}
            placeholder="For example: the phone number on my enquiry from March is no longer mine."
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button type="submit" variant="ink" disabled={sending}>
          {sending ? 'Sending…' : 'Send request'}
        </Button>
        <p className="text-[0.78rem] leading-relaxed text-ink/72">
          No fee. No newsletter. Nothing else is sent to your address because of this.
        </p>
      </div>

      {failure ? (
        <p role="alert" className="mt-4 rounded-sm border border-crimson/25 bg-crimson/6 p-3 text-[0.86rem] font-semibold text-crimson">
          {failure}
        </p>
      ) : null}

      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink/12 pt-3 text-[0.8rem] text-ink/72">
        <a className="inline-flex items-center gap-1.5 font-semibold hover:text-ink" href="mailto:hello@opudapaint.com">
          <Mail className="size-3.5" aria-hidden /> hello@opudapaint.com
        </a>
        <a className="inline-flex items-center gap-1.5 font-semibold hover:text-ink" href="tel:+2349026424350">
          <Phone className="size-3.5" aria-hidden /> {BRAND_PHONE_DISPLAY}
        </a>
      </p>
    </form>
  )
}

export default DataRequestForm
