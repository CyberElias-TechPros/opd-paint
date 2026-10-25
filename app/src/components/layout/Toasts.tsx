import { Check, Info, TriangleAlert, X } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { cn } from '../../lib/cn'

/** Polite live region: announcements do not steal focus or interrupt. */
export function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-sm border px-4 py-3 shadow-[0_24px_60px_-30px_rgba(11,26,19,0.7)]',
            'animate-[rise-in_0.4s_var(--ease-out-quint)]',
            toast.tone === 'error'
              ? 'border-crimson/40 bg-[#fff5f4] text-crimson'
              : toast.tone === 'info'
                ? 'border-ink/15 bg-paper-2 text-ink'
                : 'border-green/30 bg-[#f2f8f3] text-green-deep',
          )}
        >
          <span className="mt-0.5 shrink-0">
            {toast.tone === 'error' ? (
              <TriangleAlert className="size-4" aria-hidden />
            ) : toast.tone === 'info' ? (
              <Info className="size-4" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.86rem] font-semibold">{toast.message}</p>
            {toast.description ? <p className="mt-0.5 text-[0.76rem] opacity-75">{toast.description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full opacity-50 transition-opacity hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
