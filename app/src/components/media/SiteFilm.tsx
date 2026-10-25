import { useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * The site film.
 *
 * A 26-second portrait clip shot on a real job. It is deliberately not
 * autoplaying: the poster is a 41 KB JPEG, the 1 MB video is only requested when
 * someone presses play, and the clip has no audio track, so nobody is ambushed
 * by sound in an open-plan office. The button is a real button with a pressed
 * state, and the video keeps native controls once it starts so a keyboard user
 * can scrub, pause and go full screen.
 */
export function SiteFilm({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)

  const toggle = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      setStarted(true)
      try {
        await video.play()
        setPlaying(true)
      } catch {
        // Autoplay policies can still refuse; native controls remain usable.
        setPlaying(false)
      }
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  return (
    <figure className={cn('relative', className)}>
      <div className="relative mx-auto w-full max-w-[19rem] overflow-hidden rounded-[1.6rem] border border-ink/15 bg-ink shadow-[var(--shadow-plate)]">
        <div className="relative aspect-[9/16]">
          <video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover"
            poster="/media/project-film-poster.jpg"
            preload="none"
            playsInline
            muted
            controls={started}
            onPlay={() => {
              setStarted(true)
              setPlaying(true)
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            aria-label="OPUDA'S PAINT site film: a painter rolling a wall on a Port Harcourt site."
          >
            <source src="/media/project-film.mp4" type="video/mp4" />
            Your browser cannot play this video. The same work is documented in the photographs on this page.
          </video>

          {!started || !playing ? (
            <button
              type="button"
              onClick={toggle}
              aria-pressed={playing}
              className="group absolute inset-0 grid place-items-center bg-gradient-to-t from-ink/70 via-ink/10 to-ink/25 transition-colors hover:from-ink/60"
            >
              <span className="grid size-16 place-items-center rounded-full bg-paper-2 text-ink shadow-[0_18px_40px_-18px_rgba(11,26,19,0.9)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-105">
                <Play className="ml-0.5 size-6" aria-hidden />
              </span>
              <span className="sr-only">{started ? 'Resume the site film' : 'Play the site film'}</span>
            </button>
          ) : null}

          {started && playing ? (
            <button
              type="button"
              onClick={toggle}
              className="absolute bottom-3 left-3 grid size-10 place-items-center rounded-full bg-ink/70 text-paper-2 backdrop-blur transition hover:bg-ink"
            >
              <Pause className="size-4" aria-hidden />
              <span className="sr-only">Pause the site film</span>
            </button>
          ) : null}
        </div>
      </div>

      <figcaption className="mx-auto mt-4 max-w-[19rem] text-[0.72rem] leading-relaxed text-ink/60">
        26 seconds on a live site, filmed on a phone. No audio track, no music, no staging.
      </figcaption>
    </figure>
  )
}
