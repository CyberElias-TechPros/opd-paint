import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { useApp } from '../../store/AppStore'
import { Button } from '../ui/Button'

/**
 * Consent gate. Nothing analytical fires before a decision here. Rejecting is
 * exactly as easy as accepting — no pre-ticked boxes, no dark patterns
 * (roadmap 16.03.05). The choice is remembered and can be changed from the
 * footer.
 */
export function ConsentBar() {
  const { consent, grantConsent, denyConsent } = useApp()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (consent === 'unknown') {
      const timer = window.setTimeout(() => setVisible(true), 1200)
      return () => window.clearTimeout(timer)
    }
    setVisible(false)
    return undefined
  }, [consent])

  if (!visible || consent !== 'unknown') return null

  return (
    <div className="fixed inset-x-3 bottom-3 z-[105] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-[26rem]">
      <div className="animate-[rise-in_0.5s_var(--ease-out-quint)] rounded-sm border border-ink/15 bg-paper-2/97 p-4 shadow-[0_30px_80px_-40px_rgba(11,26,19,0.8)] backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-green/10 text-green">
            <Cookie className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-[0.86rem] font-semibold">Cookies on this site</p>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-ink/60">
              We use one cookie-free local store for your saved colours, and optional measurement cookies to understand
              which pages help people choose. Nothing is measured until you agree.{' '}
              <Link to="/legal/privacy" className="underline hover:text-green">
                Privacy notice
              </Link>
            </p>
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={denyConsent}>
            Use essentials only
          </Button>
          <Button size="sm" onClick={grantConsent}>
            Accept measurement
          </Button>
        </div>
      </div>
    </div>
  )
}
