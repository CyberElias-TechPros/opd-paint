import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('kicker flex items-center gap-2.5 text-moss', className)}>
      <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-crimson" />
      {children}
    </p>
  )
}

export function SectionHead({
  kicker,
  title,
  lede,
  action,
  align = 'left',
  className,
  as: As = 'h2',
}: {
  kicker?: string
  title: ReactNode
  lede?: ReactNode
  action?: ReactNode
  align?: 'left' | 'center'
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 md:flex-row md:items-end md:justify-between',
        align === 'center' && 'md:flex-col md:items-center md:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {kicker ? <Kicker className="mb-4">{kicker}</Kicker> : null}
        <As className="display text-[clamp(1.85rem,3.6vw,3.1rem)]">{title}</As>
        {lede ? <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink/70">{lede}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Badge({
  children,
  tone = 'line',
  className,
}: {
  children: ReactNode
  tone?: 'line' | 'green' | 'crimson' | 'paper' | 'ink' | 'gold'
  className?: string
}) {
  const tones = {
    line: 'border-ink/18 text-ink/70',
    green: 'border-green/30 bg-green/8 text-green',
    crimson: 'border-crimson/30 bg-crimson/8 text-crimson',
    paper: 'border-paper-2/30 bg-paper-2/12 text-paper-2',
    ink: 'border-ink bg-ink text-paper-2',
    gold: 'border-gold/50 bg-gold/15 text-[#7a5a16]',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.66rem] font-bold uppercase tracking-[0.13em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function ArrowLink({
  to,
  children,
  className,
  external,
  underline = true,
}: {
  to: string
  children: ReactNode
  className?: string
  external?: boolean
  underline?: boolean
}) {
  const inner = (
    <>
      <span className={cn('relative', underline && 'after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-current after:transition-transform after:duration-500 after:ease-[var(--ease-out-quint)] group-hover/arrow:after:origin-left group-hover/arrow:after:scale-x-100')}>
        {children}
      </span>
      {external ? (
        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/arrow:translate-x-0.5 group-hover/arrow:-translate-y-0.5" aria-hidden />
      ) : (
        <ArrowRight className="size-4 transition-transform duration-300 group-hover/arrow:translate-x-1" aria-hidden />
      )}
    </>
  )
  const classes = cn(
    'group/arrow inline-flex items-center gap-2 text-[0.82rem] font-bold uppercase tracking-[0.14em]',
    className,
  )
  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" className={classes}>
        {inner}
      </a>
    )
  }
  return (
    <Link to={to} className={classes}>
      {inner}
    </Link>
  )
}

export function Rule({ className }: { className?: string }) {
  return <div aria-hidden className={cn('h-px w-full bg-ink/12', className)} />
}

export function IndexNumber({ n, className }: { n: number | string; className?: string }) {
  return (
    <span className={cn('tabular text-[0.68rem] font-bold tracking-[0.18em] text-ink/72', className)}>
      {String(n).padStart(2, '0')}
    </span>
  )
}

export function Pill({ children, active, onClick, dot }: { children: ReactNode; active?: boolean; onClick?: () => void; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[0.78rem] font-semibold transition-all duration-300',
        active
          ? 'border-ink bg-ink text-paper-2'
          : 'border-ink/15 bg-transparent text-ink/75 hover:border-ink/45 hover:text-ink',
      )}
    >
      {dot ? <span aria-hidden className="size-2.5 rounded-full ring-1 ring-black/10" style={{ background: dot }} /> : null}
      {children}
    </button>
  )
}

export function FieldNote({ children }: { children: ReactNode }) {
  return <p className="text-[0.78rem] leading-relaxed text-ink/72">{children}</p>
}

export function DataRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-ink/10 py-2.5 last:border-0">
      <dt className="text-[0.78rem] text-ink/72">{label}</dt>
      <dd className="text-right text-[0.85rem] font-semibold text-ink">{value}</dd>
    </div>
  )
}
