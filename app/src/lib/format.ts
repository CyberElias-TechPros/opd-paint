/** Formatting helpers. One place, so numerals and currency stay consistent. */

export function number(value: number, places = 0): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(value)
}

export function squareMetres(value: number): string {
  return `${number(value, value < 10 ? 1 : 0)} m²`
}

export function litres(value: number): string {
  return `${number(value, value < 10 ? 1 : 0)} L`
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const dateFormatter = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })

export function longDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return dateFormatter.format(date)
}

export function minsLabel(minutes: number): string {
  return `${minutes} min read`
}

/** Deterministic quote reference: OPD-YYMMDD-XXXX from a seed. */
export function makeReference(seed = Date.now()): string {
  const d = new Date(seed)
  const y = String(d.getFullYear()).slice(2)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const tail = Math.abs(Math.sin(seed) * 10000).toFixed(0).padStart(4, '0').slice(0, 4)
  return `OPD-${y}${m}${day}-${tail}`
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}
