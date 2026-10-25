import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Accessible dialog: labelled, modal, Escape to close, focus moved in on open
 * and returned to the trigger on close, and background scroll locked. The
 * focus trap cycles Tab within the panel (roadmap 05.03.07).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  description,
  size = 'md',
  tone = 'paper',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tone?: 'paper' | 'ink'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null)

    focusables()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/55 backdrop-blur-[3px] animate-[fade-in_0.25s_ease-out]"
        style={{ animation: 'fade-in .25s ease-out' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-desc' : undefined}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-lg sm:rounded-sm',
          'border border-ink/10 shadow-[0_40px_120px_-40px_rgba(11,26,19,0.6)]',
          'animate-[rise-in_0.35s_var(--ease-out-quint)]',
          widths[size],
          tone === 'paper' ? 'bg-paper-2 text-ink' : 'bg-ink text-paper-2',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4 sm:px-7">
          <div>
            <h2 id="dialog-title" className="display text-xl sm:text-2xl">
              {title}
            </h2>
            {description ? (
              <p id="dialog-desc" className={cn('mt-1.5 text-[0.82rem]', tone === 'paper' ? 'text-ink/60' : 'text-paper-2/65')}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/15 transition-colors hover:bg-ink hover:text-paper-2"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
