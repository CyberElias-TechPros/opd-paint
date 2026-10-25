import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Scroll-triggered reveal. Uses IntersectionObserver rather than a scroll
 * listener, reveals once, and is neutralised entirely by the reduced-motion
 * rules in theme.css (the element is simply visible).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: As = 'div',
  variant = 'up',
  once = true,
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: ElementType
  variant?: 'up' | 'scale'
  once?: boolean
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true)
            if (once) observer.unobserve(entry.target)
          } else if (!once) {
            setShown(false)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [once])

  return (
    <As
      ref={ref}
      data-shown={shown ? 'true' : 'false'}
      className={cn(variant === 'up' ? 'reveal' : 'reveal-scale', className)}
      style={{ ['--reveal-delay' as string]: `${delay}ms` }}
    >
      {children}
    </As>
  )
}
