import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MapPin, Quote } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { PROJECTS, STAGE_LABEL, findProject } from '../data/projects'
import { COLOR_LRV, findColor } from '../data/colors'
import { findPalette } from '../data/palettes'
import { PRODUCTS } from '../data/products'
import { SmartImage } from '../components/media/SmartImage'
import { Badge, Kicker, ArrowLink, DataRow } from '../components/ui/Bits'
import { ButtonLink } from '../components/ui/Button'
import { ColourCard } from '../components/colour/ColourCard'
import { useApp } from '../store/AppStore'
import { useState } from 'react'
import { cn } from '../lib/cn'
import NotFound from './NotFound'

export default function ProjectDetail() {
  const { id = '' } = useParams()
  const project = findProject(id)
  const { toggleColor, isSaved, toast } = useApp()
  const [activeImage, setActiveImage] = useState(0)

  usePageMeta({
    title: project ? project.title : 'Project not found',
    description: project
      ? `${project.summary} ${project.location}, ${project.year}. Palette and products used, with links to every colour.`
      : 'Project not found.',
    path: `/inspiration/${id}`,
    image: project ? `/media/${project.cover}.webp` : undefined,
    noIndex: !project,
  })

  if (!project) return <NotFound />

  const palette = findPalette(project.paletteId)
  const colours = project.colorIds.map(findColor).filter(Boolean)
  const products = project.productIds.map((pid) => PRODUCTS.find((p) => p.id === pid)).filter(Boolean)
  const others = PROJECTS.filter((p) => p.id !== project.id).slice(0, 2)

  const saveAll = () => {
    colours.forEach((colour) => {
      if (colour && !isSaved(colour.id)) toggleColor(colour.id)
    })
    toast('Palette saved', { description: `${colours.length} colours added to your project board.` })
  }

  return (
    <>
      <header className="relative">
        <div className="relative h-[46vh] min-h-[20rem] w-full overflow-hidden sm:h-[56vh]">
          <SmartImage
            name={project.cover}
            priority
            aspect={16 / 9}
            sizes="100vw"
            className="absolute inset-0 size-full"
            imgClassName="size-full object-cover"
            overlay="bg-gradient-to-t from-ink/85 via-ink/25 to-ink/30"
          />
          <div className="absolute inset-x-0 bottom-0">
            <div className="shell pb-7 text-paper-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="paper">{STAGE_LABEL[project.stage]}</Badge>
                <span className="text-[0.68rem] uppercase tracking-[0.14em] text-paper-2/70">{project.kind}</span>
              </div>
              <h1 className="display mt-3 max-w-3xl text-[clamp(2.1rem,4.6vw,3.6rem)]">{project.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-3 text-[0.8rem] text-paper-2/75">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden /> {project.location}
                </span>
                <span aria-hidden>·</span>
                <span>{project.year}</span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="shell grid gap-10 py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)] lg:gap-14">
        <article>
          <p className="text-[1.05rem] font-medium leading-relaxed text-ink/80">{project.summary}</p>
          <div className="mt-6 space-y-4">
            {project.story.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="text-[0.95rem] leading-[1.75] text-ink/70">
                {paragraph}
              </p>
            ))}
          </div>

          <blockquote className="mt-8 flex gap-3 border-l-2 border-green pl-4">
            <Quote className="mt-1 size-4 shrink-0 text-green" aria-hidden />
            <p className="font-[var(--font-display)] text-[1.15rem] leading-snug">{project.takeaway}</p>
          </blockquote>

          <section className="mt-10" aria-labelledby="gallery-title">
            <h2 id="gallery-title" className="text-[1.05rem] font-semibold">
              Site photographs
            </h2>
            <div className="mt-3">
              <div className="overflow-hidden rounded-sm">
                <SmartImage
                  name={project.gallery[activeImage]}
                  aspect={16 / 10}
                  sizes="(max-width: 1024px) 92vw, 60vw"
                  className="w-full"
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {project.gallery.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-pressed={index === activeImage}
                    className={cn(
                      'overflow-hidden rounded-[3px] ring-2 transition-all',
                      index === activeImage ? 'ring-ink' : 'ring-transparent hover:ring-ink/30',
                    )}
                    aria-label={`Show photograph ${index + 1} of ${project.gallery.length}`}
                  >
                    <SmartImage name={image} aspect={4 / 3} sizes="15vw" />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="palette-title">
            <div className="flex items-end justify-between gap-4">
              <h2 id="palette-title" className="text-[1.05rem] font-semibold">
                The colours used
              </h2>
              <button
                type="button"
                onClick={saveAll}
                className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-green hover:underline"
              >
                Save the palette
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {colours.map((colour) => (colour ? <ColourCard key={colour.id} colour={colour} height="compact" /> : null))}
            </div>
            {palette ? (
              <p className="mt-3 text-[0.8rem] text-ink/72">
                Curated as <Link to={`/colours?palette=${palette.id}`} className="font-semibold text-green hover:underline">{palette.name}</Link> — {palette.bestFor.toLowerCase()}.
              </p>
            ) : null}
          </section>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <Kicker className="mb-3">Project facts</Kicker>
            <dl>
              <DataRow label="Stage" value={STAGE_LABEL[project.stage]} />
              <DataRow label="Type" value={project.kind} />
              <DataRow label="Location" value={project.location} />
              <DataRow label="Year" value={project.year} />
              <DataRow label="Colours" value={`${project.colorIds.length} records`} />
              <DataRow label="Products" value={products.map((p) => p?.shortName).join(', ') || '—'} />
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <ButtonLink to="/quote" size="sm" fullWidth>
                Quote something similar
              </ButtonLink>
              <ButtonLink to="/room-preview" size="sm" variant="outline" fullWidth>
                Preview these colours
              </ButtonLink>
            </div>
          </div>

          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <p className="kicker mb-2 text-ink/72">On this scheme</p>
            <div className="h-12 overflow-hidden rounded-[2px]">
              <div className="flex h-full">
                {colours.map((colour) => (
                  <span key={colour?.id} className="flex-1" style={{ background: colour?.hex }} title={colour?.name} />
                ))}
              </div>
            </div>
            <ul className="mt-3 space-y-1 text-[0.76rem] text-ink/72">
              {colours.slice(0, 4).map((colour) =>
                colour ? (
                  <li key={colour.id} className="flex justify-between gap-2">
                    <Link to={`/colours/${colour.id}`} className="hover:text-green">
                      {colour.name}
                    </Link>
                    <span className="text-ink/72">LRV ≈ {COLOR_LRV(colour)}</span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>

          <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
            <p className="kicker mb-2 text-ink/72">More projects</p>
            <ul className="space-y-3">
              {others.map((other) => (
                <li key={other.id}>
                  <Link to={`/inspiration/${other.id}`} className="group flex items-center gap-3">
                    <SmartImage name={other.cover} aspect={1} sizes="70px" className="w-16 shrink-0 rounded-[2px]" />
                    <span>
                      <span className="block text-[0.82rem] font-semibold leading-tight group-hover:text-green">{other.title}</span>
                      <span className="block text-[0.7rem] text-ink/72">{other.location}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <nav className="shell flex items-center justify-between border-t border-ink/12 py-6" aria-label="Project navigation">
        <Link to="/inspiration" className="inline-flex items-center gap-2 text-[0.8rem] font-semibold hover:text-green">
          <ArrowLeft className="size-4" aria-hidden /> All projects
        </Link>
        <ArrowLink to={`/inspiration/${others[0]?.id ?? ''}`}>
          {others[0]?.title}
          <ArrowRight className="size-3.5" aria-hidden />
        </ArrowLink>
      </nav>
    </>
  )
}
