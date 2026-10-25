import { Link, useSearchParams } from 'react-router-dom'
import { Lock, MousePointerClick, Paintbrush, Sparkles } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { RoomVisualizer } from '../components/visualizer/RoomVisualizer'
import { findColor } from '../data/colors'
import { Kicker, ArrowLink } from '../components/ui/Bits'

export default function RoomPreview() {
  const [params] = useSearchParams()
  const initial = findColor(params.get('colour') ?? '')

  usePageMeta({
    title: 'Room preview — paint your own wall',
    description:
      'Upload a photograph of your room, select a wall and try any OPUDA’S colour before you buy. Switch between matt and silk, compare before and after, and download a preview for your painter. Your photo never leaves your browser.',
    path: '/room-preview',
    image: '/media/interior-mauve-peach.webp',
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-12">
          <Kicker className="mb-4">Room preview</Kicker>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="display text-[clamp(2.3rem,4.8vw,3.8rem)]">
                Try it on <span className="italic">your</span> wall.
              </h1>
              <p className="mt-4 text-[0.98rem] leading-relaxed text-ink/65">
                Start with one of our site photographs or upload your own room. Tap the wall you want to change, then
                work through the library. Nothing is uploaded — every calculation happens inside this tab.
              </p>
            </div>
            <ul className="grid gap-2 text-[0.78rem] text-ink/60 sm:grid-cols-3 lg:max-w-md">
              {[
                { icon: MousePointerClick, text: 'Tap a wall to select it' },
                { icon: Paintbrush, text: 'Brush the edges by hand' },
                { icon: Lock, text: 'Your photo stays local' },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2 rounded-sm border border-ink/10 bg-paper-2/60 p-2.5">
                  <item.icon className="mt-0.5 size-3.5 shrink-0 text-green" aria-hidden />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <section className="shell py-8">
        <RoomVisualizer initialColour={initial} />
      </section>

      <section className="shell pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'A simulation, not a promise',
              body: 'The preview keeps the light and shadow in your photograph and swaps the hue. Real paint also reflects light differently depending on finish, substrate and time of day.',
            },
            {
              title: 'Better with a straight-on photo',
              body: 'Stand square to the wall and let daylight in. Avoid flash, and keep the camera still. A phone photo at eye height is enough.',
            },
            {
              title: 'Take it to the painter',
              body: 'Save the preview and send it with the colour code. Your painter can then confirm the quantity and the number of coats on site.',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-sm border border-ink/12 bg-paper-2/50 p-5">
              <Sparkles className="size-4 text-green" aria-hidden />
              <h2 className="mt-2 font-[var(--font-display)] text-[1.1rem]">{card.title}</h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink/60">{card.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <ArrowLink to="/calculator">Now size the job</ArrowLink>
          <ArrowLink to="/quote">Request a colour consultation</ArrowLink>
          <Link to="/advice/colour-on-screen" className="text-[0.78rem] font-semibold text-ink/60 underline hover:text-green">
            Why screens differ from paint
          </Link>
        </div>
      </section>
    </>
  )
}
