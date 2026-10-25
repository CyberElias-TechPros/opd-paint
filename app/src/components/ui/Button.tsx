import { Link } from 'react-router-dom'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'solid' | 'ink' | 'outline' | 'ghost' | 'paper' | 'crimson'
type Size = 'sm' | 'md' | 'lg'

const base =
  'group/btn relative inline-flex items-center justify-center gap-2 font-semibold tracking-[0.005em] ' +
  'transition-[transform,background-color,color,border-color,box-shadow] duration-300 ease-[var(--ease-out-quint)] ' +
  'disabled:pointer-events-none disabled:opacity-45 rounded-[3px] select-none'

const variants: Record<Variant, string> = {
  solid: 'bg-green text-paper-2 hover:bg-green-deep shadow-[0_1px_0_rgba(0,0,0,0.06)]',
  ink: 'bg-ink text-paper-2 hover:bg-green-deep',
  outline: 'border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-paper-2',
  ghost: 'text-ink hover:bg-ink/6',
  paper: 'bg-paper-2 text-ink border border-line hover:border-ink/40 hover:shadow-[0_10px_30px_-18px_rgba(11,26,19,0.5)]',
  crimson: 'bg-crimson text-white hover:bg-[#9d0d18]',
}

const sizes: Record<Size, string> = {
  sm: 'text-[0.78rem] px-3.5 py-2 min-h-9',
  md: 'text-[0.86rem] px-5 py-3 min-h-11',
  lg: 'text-[0.95rem] px-7 py-4 min-h-13',
}

type CommonProps = {
  variant?: Variant
  size?: Size
  className?: string
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'solid',
  size = 'md',
  className,
  fullWidth,
  children,
  ...rest
}: CommonProps & ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  variant = 'solid',
  size = 'md',
  className,
  fullWidth,
  children,
  to,
  external,
  ...rest
}: CommonProps & { to: string; external?: boolean } & Omit<ComponentPropsWithoutRef<'a'>, 'href'>) {
  const classes = cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)
  if (external) {
    return (
      <a className={classes} href={to} target="_blank" rel="noreferrer noopener" {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link className={classes} to={to} {...rest}>
      {children}
    </Link>
  )
}
