/**
 * API client.
 *
 * The browser only ever calls same-origin `/api/*` URLs; Vite proxies those to
 * the local Node service in `server/`. If the service is unreachable (static
 * preview, outage), the UI must degrade honestly: the submission is kept on the
 * visitor's device and they are given a phone/WhatsApp route that works.
 */

export type ApiError = { ok: false; error: string; fields?: Record<string, string> }

/**
 * A rejection the server can explain field by field.
 *
 * Client-side validation is a courtesy, not the boundary — the server decides
 * what is acceptable. When it refuses, its per-field messages are surfaced on
 * the inputs rather than collapsed into one generic banner.
 */
export class ApiFieldError extends Error {
  fields: Record<string, string>

  constructor(message: string, fields: Record<string, string>) {
    super(message)
    this.name = 'ApiFieldError'
    this.fields = fields
  }
}
export type ApiOk<T> = { ok: true; data: T }

export type QuotePayload = {
  name: string
  phone: string
  email?: string | undefined
  city: string
  projectType: string
  rooms?: string | undefined
  message?: string | undefined
  colors?: string[]
  products?: string[]
  quantities?: Array<{ label: string; amount: number; unit: string }>
  consent: boolean
  /** honeypot field — must stay empty */
  company?: string
  source?: string
}

export type QuoteResponse = {
  reference: string
  receivedAt: string
  routedTo: string
  slaHours: number
}

const TIMEOUT_MS = 12_000

async function post<T>(path: string, body: unknown): Promise<ApiOk<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    let json: ApiOk<T> | ApiError
    try {
      json = (await res.json()) as ApiOk<T> | ApiError
    } catch {
      throw new Error(
        res.ok
          ? 'The server sent an unexpected reply.'
          : `The enquiry service is not available right now (${res.status}).`,
      )
    }
    if (!res.ok || !('ok' in json) || json.ok === false) {
      const failure = json as ApiError
      if (failure.fields && Object.keys(failure.fields).length) {
        throw new ApiFieldError(failure.error ?? 'Some details need attention.', failure.fields)
      }
      throw new Error(failure.error ?? `Request failed (${res.status})`)
    }
    return json
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The enquiry service took too long to answer.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function submitQuote(payload: QuotePayload): Promise<QuoteResponse> {
  const res = await post<QuoteResponse>('/api/quotes', payload)
  return res.data
}

export async function subscribe(email: string, interest: string): Promise<{ email: string; resubscribed?: boolean }> {
  const res = await post<{ email: string; resubscribed?: boolean }>('/api/subscribe', { email, interest })
  return res.data
}

/**
 * Withdraw consent to the newsletter.
 *
 * NDPA section 34 makes opting out as important as opting in, and the copy under
 * the sign-up form has always promised it — so this is not a convenience, it is
 * the other half of a promise the site already makes in public. The service
 * records a suppression entry rather than deleting the address: we have to be
 * able to show that an opt-out was honoured.
 */
export async function unsubscribe(email: string, source = 'footer'): Promise<{ email: string }> {
  const res = await post<{ email: string }>('/api/unsubscribe', { email, source })
  return res.data
}

export type ColourHit = { id: string; name: string; code: string; hex?: string | undefined; family?: string | undefined }

/**
 * Server-side colour search.
 *
 * The palette indexes the library locally, which is why this is not on the
 * critical path — but the service can be updated without redeploying the bundle
 * (a colour added to the index by hand on a host, a future CMS), so the palette
 * falls back to it when the local index finds nothing. A failure here is
 * indistinguishable from "no results" by design: search must never break a page.
 */
export async function searchColours(query: string): Promise<ColourHit[]> {
  const url = new URL('/api/search/colours', window.location.origin)
  url.searchParams.set('q', query)
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) return []
  const json = (await res.json()) as { results?: ColourHit[] }
  return Array.isArray(json.results) ? json.results : []
}

/**
 * Failed-submission drafts.
 *
 * Storing an unsent enquiry is only half of the promise "nothing is lost": the
 * other half is giving it back. A draft is read once when the form mounts, shown
 * as a notice the visitor can dismiss, and deleted the moment a submission
 * succeeds — a form that quietly re-fills yesterday's phone number is how stale
 * personal data ends up being sent to the wrong desk.
 */
export type StashedSubmission<T> = { body: T; at: number }

/** Discard drafts older than a day: an enquiry that old has been phoned in. */
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

const draftKey = (kind: string) => `opd.draft.${kind}`

export function stashFailedSubmission(kind: string, body: unknown) {
  try {
    localStorage.setItem(draftKey(kind), JSON.stringify({ body, at: Date.now() }))
  } catch {
    /* quota or private mode — nothing else we can do */
  }
}

export function readStashedSubmission<T>(kind: string): StashedSubmission<T> | null {
  try {
    const raw = localStorage.getItem(draftKey(kind))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StashedSubmission<T>>
    if (!parsed || typeof parsed !== 'object' || !parsed.body) return null
    const at = typeof parsed.at === 'number' ? parsed.at : 0
    if (!at || Date.now() - at > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(draftKey(kind))
      return null
    }
    return { body: parsed.body as T, at }
  } catch {
    return null
  }
}

export function clearStashedSubmission(kind: string) {
  try {
    localStorage.removeItem(draftKey(kind))
  } catch {
    /* noop */
  }
}
