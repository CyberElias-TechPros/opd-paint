import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type WrapProps = {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  className?: string
  /**
   * A checkbox or radio set is already labelled by its own `<label>`. Rendering
   * a second `<label for>` there gives the control two labels and a doubled
   * accessible name, so those callers ask for a plain `span` heading instead.
   */
  labelAs?: 'label' | 'span'
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

export function Field({ label, hint, error, required, className, labelAs = 'label', children }: WrapProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {(() => {
        const heading = (
          <>
            {label}
            {required ? (
              <span className="ml-1 text-crimson" aria-hidden>
                *
              </span>
            ) : (
              <span className="ml-1.5 font-medium normal-case tracking-normal text-ink/60">optional</span>
            )}
          </>
        )
        const className = 'text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink/60'
        return labelAs === 'label' ? (
          <label htmlFor={id} className={className}>
            {heading}
          </label>
        ) : (
          <span className={className}>{heading}</span>
        )
      })()}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-[0.76rem] leading-relaxed text-ink/60">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[0.76rem] font-semibold text-crimson">
          <span aria-hidden>⚠</span>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function TextInput({ className, ...rest }: ComponentPropsWithoutRef<'input'>) {
  return <input className={cn('field', className)} {...rest} />
}

export function TextArea({ className, ...rest }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea className={cn('field min-h-28 resize-y', className)} {...rest} />
}

export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select className={cn('field appearance-none bg-[length:14px] pr-9', className)} {...rest}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2326362e' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.85rem center',
      }}
    >
      {children}
    </select>
  )
}

export function Checkbox({
  label,
  description,
  className,
  id: providedId,
  ...rest
}: ComponentPropsWithoutRef<'input'> & { label: ReactNode; description?: ReactNode }) {
  // The id has to be the same one the label points at. Taking the generated id
  // and then letting `...rest` overwrite it on the input detached the label
  // from its checkbox — a screen reader read the consent text as loose prose.
  const generatedId = useId()
  const id = providedId ?? generatedId
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--color-green)]"
        {...rest}
        id={id}
      />
      <label htmlFor={id} className="cursor-pointer text-[0.84rem] leading-relaxed text-ink/75">
        {label}
        {description ? <span className="mt-1 block text-[0.78rem] text-ink/60">{description}</span> : null}
      </label>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-4 rounded-sm border border-ink/12 bg-paper-2/70 px-3.5 py-3 text-left transition-colors hover:border-ink/30"
    >
      <span>
        <span className="block text-[0.82rem] font-semibold text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-[0.74rem] text-ink/60">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-green' : 'bg-ink/20',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-300',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </span>
    </button>
  )
}
