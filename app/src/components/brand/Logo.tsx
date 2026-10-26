import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

/**
 * Brand marks.
 *
 * Redrawn from the pail label: the house device, the deep green wordmark and the
 * five coloured letters of "PAINT". The wordmark is set in Archivo at its heavy
 * end with tight tracking, because that is what the printed label does — a
 * serif here would look like a different company. Everything is vector, so the
 * lockup holds at 32px in the header and on an A0 banner alike.
 */

const LETTER_COLOURS = ['#C1121F', '#0C6B45', '#1F6FB2', '#6C3FA4', '#EE6C22']
const PAINT_LETTERS = ['P', 'A', 'I', 'N', 'T']

export function Mark({ className, title = "OPUDA'S PAINT" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 40" role="img" aria-label={title} className={cn('shrink-0', className)}>
      <path d="M24 2.4 45 16.2v3.2L24 5.8 3 19.4v-3.2L24 2.4Z" fill="#0C6B45" />
      <path d="M8.6 15.8 24 5.9l15.4 9.9v17.4c0 .9-.7 1.6-1.6 1.6H10.2c-.9 0-1.6-.7-1.6-1.6V15.8Z" fill="#0C6B45" />
      <path d="M13.4 19.6 24 12.8l10.6 6.8v15.2H13.4V19.6Z" fill="#FCF9F3" />
      <path d="M21.2 22.4h5.6v12.4h-5.6z" fill="#C1121F" />
      <path d="M19.5 30.6c0 2.8 2.1 4.9 4.5 4.9s4.5-2.1 4.5-4.9V22.4h-1.9v7.6a2.6 2.6 0 0 1-5.2 0v-1.4h-1.9v2Z" fill="#C1121F" opacity="0" />
      <circle cx="40.6" cy="6.2" r="2.3" fill="#EE6C22" />
      <path d="M8.9 31.6c0 1.9 1.3 3.2 2.9 3.2s2.9-1.3 2.9-3.2c0-1.6-2.9-4.9-2.9-4.9s-2.9 3.3-2.9 4.9Z" fill="#C1121F" />
    </svg>
  )
}

export function Wordmark({ className, tone = 'ink' }: { className?: string; tone?: 'ink' | 'paper' }) {
  return (
    <span className={cn('flex flex-col leading-none', className)}>
      <span
        className={cn(
          'font-sans text-[1.02rem] font-extrabold uppercase leading-none tracking-[-0.015em] sm:text-[1.12rem]',
          tone === 'ink' ? 'text-green' : 'text-paper-2',
        )}
      >
        OPUDA&rsquo;S
      </span>
      <span className="mt-[5px] flex font-sans text-[0.66rem] font-extrabold leading-none tracking-[0.44em]">
        {PAINT_LETTERS.map((letter, index) => (
          <span key={letter} style={{ color: LETTER_COLOURS[index] }} aria-hidden>
            {letter}
          </span>
        ))}
        <span className="sr-only">PAINT</span>
      </span>
    </span>
  )
}

export function LogoLockup({ tone = 'ink', className }: { tone?: 'ink' | 'paper'; className?: string }) {
  return (
    <Link
      to="/"
      // No aria-label. The name comes from the wordmark itself, so it matches
      // the text on screen exactly — which is what a voice-control user reads
      // out, and what the label-in-name rule requires. The house mark is
      // decorative here because the wordmark already says the same thing; the
      // `sr-only` tail adds the destination without changing the visible text.
      className={cn('group flex items-center gap-2.5 outline-offset-4', className)}
    >
      <span aria-hidden>
        <Mark className="h-8 w-auto transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-rotate-3 group-hover:scale-105 sm:h-9" />
      </span>
      <Wordmark tone={tone} />
      <span className="sr-only">— home page</span>
    </Link>
  )
}
