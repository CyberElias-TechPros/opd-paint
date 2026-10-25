import type { ReactNode } from 'react'

/**
 * Empty states are part of the product, not an afterthought: they explain what
 * would be here, why it is not, and the single most useful next action.
 */
export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="rounded-sm border border-dashed border-ink/20 bg-white/40 px-6 py-10 text-center">
      {icon ? <div className="mx-auto mb-3 grid size-10 place-items-center text-ink/60">{icon}</div> : null}
      <p className="font-[var(--font-display)] text-lg font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[0.82rem] leading-relaxed text-ink/60">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-sm border border-crimson/30 bg-crimson/5 px-6 py-8">
      <p className="font-[var(--font-display)] text-lg font-medium text-crimson">{title}</p>
      <p className="mt-1.5 max-w-prose text-[0.85rem] leading-relaxed text-ink/70">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
