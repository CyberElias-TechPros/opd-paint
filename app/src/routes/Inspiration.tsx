import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { PROJECTS, STAGE_LABEL, type Stage } from '../data/projects'
import { COLORS } from '../data/colors'
import { SmartImage } from '../components/media/SmartImage'
import { SiteFilm } from '../components/media/SiteFilm'
import { Badge, Kicker, ArrowLink } from '../components/ui/Bits'
import { Pill } from '../components/ui/Bits'
import { Reveal } from '../components/motion/Reveal'
import { cn } from '../lib/cn'

const KINDS = ['All', 'Exterior', 'Interior', 'Boundary & gate', 'Concept design'] as const
const STAGES: Array<Stage | 'All'> = ['All', 'completed', 'in progress', 'concept']

export default function Inspiration() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All')
  const [stage, setStage] = useState<Stage | 'All'>('All')

  const list = useMemo(
    () =>
      PROJECTS.filter((project) => {
        if (kind !== 'All' && project.kind !== kind) return false
        if (stage !== 'All' && project.stage !== stage) return false
        return true
      }),
    [kind, stage],
  )

  usePageMeta({
    title: 'Inspiration — real OPUDA’S sites',
    description:
      'Photographs from OPUDA’S PAINT sites across Port Harcourt and Rivers State: finished villas, boundary walls, interior schemes and concept studies. Each project lists the palette and the products used.',
    path: '/inspiration',
    image: '/media/project-finished-villa.webp',
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Site record</Kicker>
          <h1 className="display max-w-3xl text-[clamp(2.3rem,4.8vw,3.8rem)]">
            Our photography, <span className="italic">not a stock library.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/65">
            Every frame here was photographed on an OPUDA’S site. We publish the stage honestly — some are finished,
            some are mid-build, and two are concept studies with no paint applied yet.
          </p>
        </div>
      </header>

      <section className="shell grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-16">
        <div>
          <Kicker className="mb-3">The site film</Kicker>
          <h2 className="display max-w-lg text-[clamp(1.9rem,3.6vw,2.9rem)]">
            What the work actually looks like at 9am.
          </h2>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink/65">
            Photographs get curated. A 26-second clip does not. This was shot on a phone during a
            topcoat run — the same emulsion and the same roller you would be quoted for, on a wall
            that had been screeded two days earlier.
          </p>
          <ul className="mt-6 space-y-2 text-[0.85rem] text-ink/70">
            <li>· Filmed on an OPUDA&rsquo;S site in Port Harcourt, not in a studio</li>
            <li>· No audio, no music, no voiceover</li>
            <li>· Portrait, because that is how the painter sent it to us</li>
          </ul>
          <div className="mt-6">
            <ArrowLink to="/advice/preparing-walls">Why the wall was screeded first</ArrowLink>
          </div>
        </div>
        <SiteFilm />
      </section>

      <div className="shell py-8">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-2" role="group" aria-label="Filter by project type">
          {KINDS.map((option) => (
            <Pill key={option} active={kind === option} onClick={() => setKind(option)}>
              {option}
            </Pill>
          ))}
        </div>
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-2" role="group" aria-label="Filter by stage">
          {STAGES.map((option) => (
            <Pill key={option} active={stage === option} onClick={() => setStage(option)}>
              {option === 'All' ? 'Any stage' : STAGE_LABEL[option]}
            </Pill>
          ))}
        </div>

        <p className="mt-3 text-[0.8rem] text-ink/60" aria-live="polite">
          {list.length} project{list.length === 1 ? '' : 's'}
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {list.map((project, index) => (
            <Reveal key={project.id} delay={index * 60}>
              <article className="group overflow-hidden rounded-sm border border-ink/12 bg-paper-2/60">
                <Link to={`/inspiration/${project.id}`} className="block overflow-hidden">
                  <SmartImage
                    name={project.cover}
                    aspect={16 / 11}
                    sizes="(max-width: 768px) 92vw, 46vw"
                    imgClassName="transition-transform duration-[1.4s] ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
                  />
                </Link>
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={project.stage === 'completed' ? 'green' : project.stage === 'concept' ? 'line' : 'gold'}>
                      {STAGE_LABEL[project.stage]}
                    </Badge>
                    <span className="text-[0.66rem] uppercase tracking-[0.12em] text-ink/60">{project.kind}</span>
                  </div>
                  <h2 className="mt-2 font-[var(--font-display)] text-[1.45rem] leading-tight">
                    <Link to={`/inspiration/${project.id}`} className="hover:text-green">
                      {project.title}
                    </Link>
                  </h2>
                  <p className="text-[0.74rem] text-ink/60">
                    {project.location} · {project.year}
                  </p>
                  <p className="mt-2 text-[0.86rem] leading-relaxed text-ink/60">{project.summary}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex gap-1.5">
                      {project.colorIds.slice(0, 6).map((cid) => {
                        const colour = COLORS.find((c) => c.id === cid)
                        return colour ? (
                          <span
                            key={cid}
                            className="size-5 rounded-[2px] ring-1 ring-inset ring-black/10"
                            style={{ background: colour.hex }}
                            title={colour.name}
                          />
                        ) : null
                      })}
                    </div>
                    <Link
                      to={`/inspiration/${project.id}`}
                      className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-green"
                    >
                      Open <ArrowRight className={cn('size-3.5 transition-transform group-hover:translate-x-1')} aria-hidden />
                    </Link>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-sm bg-ink px-5 py-5 text-paper-2">
          <p className="font-[var(--font-display)] text-[1.2rem]">Painting something we have not photographed yet?</p>
          <ArrowLink to="/quote" className="text-paper-2">
            Send us the project
          </ArrowLink>
        </div>
      </div>
    </>
  )
}
