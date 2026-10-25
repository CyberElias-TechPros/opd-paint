/**
 * API client.
 *
 * The browser only ever calls same-origin `/api/*` URLs; Vite proxies those to
 * the local Node service in `server/`. If the service is unreachable (static
 * preview, outage), the UI must degrade honestly: the submission is kept on the
 * visitor's device and they are given a phone/WhatsApp route that works.
 */

export type ApiError = { ok: false; error: string; fields?: Record<string, string> }
export type ApiOk<T> = { ok: true; data: T }

export type QuotePayload = {
  name: string
  phone: string
  email?: string
  city: string
  projectType: string
  rooms?: string
  message?: string
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
    const json = (await res.json()) as ApiOk<T> | ApiError
    if (!res.ok || !('ok' in json) || json.ok === false) {
      const error = (json as ApiError).error ?? `Request failed (${res.status})`
      throw new Error(error)
    }
    return json
  } finally {
    clearTimeout(timer)
  }
}

export async function submitQuote(payload: QuotePayload): Promise<QuoteResponse> {
  const res = await post<QuoteResponse>('/api/quotes', payload)
  return res.data
}

export async function subscribe(email: string, interest: string): Promise<{ email: string }> {
  const res = await post<{ email: string }>('/api/subscribe', { email, interest })
  return res.data
}

export async function searchColours(query: string): Promise<{ results: Array<{ id: string; name: string; code: string; hex: string }> }> {
  const url = new URL('/api/search/colours', window.location.origin)
  url.searchParams.set('q', query)
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error('Search unavailable')
  return (await res.json()) as { results: Array<{ id: string; name: string; code: string; hex: string }> }
}

/** Keeps an unsent submission on the device so nothing is lost on failure. */
export function stashFailedSubmission(kind: string, body: unknown) {
  try {
    const key = `opd.draft.${kind}`
    localStorage.setItem(key, JSON.stringify({ body, at: Date.now() }))
  } catch {
    /* quota — nothing else we can do */
  }
}
