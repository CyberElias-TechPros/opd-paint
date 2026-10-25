import { useId, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * The three devices the whole identity is built from.
 *
 * All three come off the pail label, which is the only piece of artwork the
 * company actually printed:
 *
 *   · the crimson paint swash that sweeps across the lower half of the bucket
 *   · the circular "GUARANTEED 5 YEARS" seal
 *   · the pale plank wall the pails are photographed against
 *
 * They are drawn as vectors rather than cropped from the label, so they stay
 * sharp at any size and tint to the current text colour. Nothing here invents a
 * claim — the seal only says what the label says.
 */

/** The crimson brush sweep. Used as an underline, never as a container. */
export function PaintSwash({
  className,
  tone = 'crimson',
  flip = false,
}: {
  className?: string
  tone?: 'crimson' | 'green' | 'gold' | 'paper'
  flip?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const tones = {
    crimson: ['#C1121F', '#8E0D16'],
    green: ['#0C6B45', '#07452D'],
    gold: ['#DFAE52', '#A97A22'],
    paper: ['#FCF9F3', '#E2D6C3'],
  } as const
  const [light, dark] = tones[tone]

  return (
    <svg
      aria-hidden
      viewBox="0 0 320 48"
      preserveAspectRatio="none"
      className={cn('pointer-events-none', className)}
      style={flip ? { transform: 'scaleY(-1)' } : undefined}
    >
      <defs>
        <linearGradient id={`swash-${id}`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* the body of the stroke: a loaded brush pulling left to right */}
      <path
        d="M2 33.6C46 24.4 92 18.5 158 15.1c56-2.9 110 0 160 8l-1.4 8.1c-54-6.6-104-3.8-160-0.6-60 3.4-108 3.3-152 9.6Z"
        fill={`url(#swash-${id})`}
      />
      {/* bristle streaks just outside the body — what makes it read as paint */}
      <path d="M14 42.4c58-5.1 128-8.2 198-9.7" stroke={light} strokeWidth="1.5" opacity="0.45" strokeLinecap="round" fill="none" />
      <path d="M226 22.6c26 .8 52 2.3 76 4.6" stroke={light} strokeWidth="1.3" opacity="0.35" strokeLinecap="round" fill="none" />
      <path d="M38 25.2c40-5.4 92-8.9 148-9.6" stroke="#FFFFFF" strokeWidth="1.1" opacity="0.22" strokeLinecap="round" fill="none" />
      {/* two dry spots, because a brush never lays an even film */}
      <ellipse cx="96" cy="27.4" rx="3.4" ry="1.1" fill="#FCF9F3" opacity="0.28" />
      <ellipse cx="238" cy="25.6" rx="2.6" ry="0.9" fill="#FCF9F3" opacity="0.22" />
    </svg>
  )
}

/** The guarantee seal, redrawn from the label. */
export function GuaranteeSeal({
  className,
  label = 'Guaranteed five years on Matt and Silk',
}: {
  className?: string
  label?: string
}) {
  const id = useId().replace(/:/g, '')
  return (
    <div className={cn('relative aspect-square', className)}>
      <svg viewBox="0 0 120 120" className="size-full" role="img" aria-label={label}>
        <defs>
          <path id={`seal-top-${id}`} d="M60,60 m-43,0 a43,43 0 1,1 86,0" />
        </defs>

        <circle cx="60" cy="60" r="58" fill="#FCF9F3" />
        <circle cx="60" cy="60" r="58" fill="none" stroke="#0C6B45" strokeWidth="2.4" />
        <circle cx="60" cy="60" r="52.5" fill="none" stroke="#0C6B45" strokeWidth="0.8" opacity="0.45" />

        {/* the label's wrap-around claim, set on the top arc only: a second line
            at the bottom would collide with the brush stroke */}
        <text
          fill="#0B1A13"
          fontFamily="Archivo Variable, ui-sans-serif, sans-serif"
          fontWeight="800"
          fontSize="8"
          letterSpacing="2.3"
        >
          <textPath href={`#seal-top-${id}`} startOffset="50%" textAnchor="middle">
            GUARANTEED
          </textPath>
        </text>

        <g transform="translate(51.6 31) scale(0.35)" fill="#0C6B45">
          <path d="M24 2.4 45 16.2v3.2L24 5.8 3 19.4v-3.2L24 2.4Z" />
          <path d="M8.6 15.8 24 5.9l15.4 9.9v17.4c0 .9-.7 1.6-1.6 1.6H10.2c-.9 0-1.6-.7-1.6-1.6V15.8Z" />
          <path d="M21.2 24.4h5.6v10.4h-5.6z" fill="#C1121F" />
        </g>

        <text
          x="60"
          y="71"
          textAnchor="middle"
          fill="#0B1A13"
          fontFamily="Instrument Serif, Georgia, serif"
          fontSize="27"
        >
          5
        </text>
        <text
          x="60"
          y="80"
          textAnchor="middle"
          fill="#4D6157"
          fontFamily="Archivo Variable, ui-sans-serif, sans-serif"
          fontWeight="800"
          fontSize="5.4"
          letterSpacing="1.4"
        >
          YEARS
        </text>

        {/* the crimson sweep, held inside the ring so the badge reads at 64px */}
        <path d="M31 92.5c18-5.4 44-5.8 58-3" fill="none" stroke="#C1121F" strokeWidth="5.2" strokeLinecap="round" />
        <path d="M40 88.2c14-2.9 30-3.4 42-2.1" fill="none" stroke="#C1121F" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      </svg>
    </div>
  )
}

/**
 * The cream plank wall from the label photography.
 *
 * Pure CSS: one board-width gradient tiled horizontally for the seams, and a
 * broad top-down light so it never looks like a repeating pattern. The existing
 * `grain` utility adds the plaster speckle on top.
 */
export function PlankWall({
  className,
  children,
  style,
}: {
  className?: string
  children?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      className={cn('grain relative isolate overflow-hidden', className)}
      style={{
        backgroundColor: '#efe5d4',
        backgroundImage: [
          'linear-gradient(90deg, rgba(11,26,19,0.13) 0, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.12) 40%, rgba(11,26,19,0.05) 92%, rgba(11,26,19,0.16) 100%)',
          'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 42%, rgba(169,85,60,0.07) 100%)',
        ].join(','),
        backgroundSize: '86px 100%, 100% 100%',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
