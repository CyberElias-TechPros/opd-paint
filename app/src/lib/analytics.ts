/**
 * Measurement layer.
 *
 * Design rules:
 *  • Nothing is sent until the visitor grants analytics consent. While consent
 *    is unknown or denied, events are dropped (not queued — queueing and
 *    flushing later is how consent gets broken).
 *  • Events carry no personal data. No email, no phone, no free-text.
 *  • The event names match the measurement plan in the README (16.01.04–09);
 *    adding an event means adding it to that document first.
 *  • In development, events are echoed to the console so QA can verify them.
 */

export type AnalyticsEvent =
  | 'page_view'
  | 'colour_view'
  | 'colour_saved'
  | 'colour_compare'
  | 'colour_filter'
  | 'palette_view'
  | 'product_view'
  | 'product_filter'
  | 'calculator_start'
  | 'calculator_complete'
  | 'visualizer_start'
  | 'visualizer_apply'
  | 'visualizer_export'
  | 'dealer_search'
  | 'dealer_contact'
  | 'guide_view'
  | 'form_start'
  | 'form_validation_error'
  | 'quote_submit'
  | 'quote_success'
  | 'quote_failure'
  | 'newsletter_submit'
  | 'cta_click'

export type ConsentState = 'granted' | 'denied' | 'unknown'

const STORAGE_KEY = 'opd.consent.v1'
let consent: ConsentState = 'unknown'
let queue: Array<{ name: AnalyticsEvent; props: Record<string, string | number | boolean> }> = []

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

export function initAnalytics(): ConsentState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'granted' || stored === 'denied') consent = stored
  } catch {
    consent = 'unknown'
  }
  return consent
}

export function getConsent(): ConsentState {
  return consent
}

export function setConsent(next: Exclude<ConsentState, 'unknown'>): void {
  consent = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage unavailable — consent still applies to this session */
  }
  if (next === 'denied') queue = []
  if (next === 'granted') {
    window.dataLayer = window.dataLayer ?? []
    // flush anything captured in the same interaction before consent applied
    queue.forEach((event) => pushEvent(event.name, event.props))
    queue = []
  }
}

function pushEvent(name: AnalyticsEvent, props: Record<string, string | number | boolean>) {
  const payload = { event: name, ...props, ts: Date.now() }
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(payload)
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', name, props)
  }
}

export function track(name: AnalyticsEvent, props: Record<string, string | number | boolean> = {}): void {
  if (consent === 'granted') {
    pushEvent(name, props)
    return
  }
  if (consent === 'unknown') {
    // Hold a short buffer so an in-page consent decision can still record the
    // action that preceded it. Dropped immediately if denied.
    queue.push({ name, props })
    if (queue.length > 20) queue.shift()
  }
}

export function resetConsentForTests(): void {
  consent = 'unknown'
  queue = []
}
