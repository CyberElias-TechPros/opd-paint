import { usePageMeta } from '../lib/seo'
import { Badge, Kicker, SectionHead } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { Checkbox, Field, Select, TextInput, Toggle } from '../components/ui/Field'
import { useState } from 'react'

const COLOUR_TOKENS = [
  { name: 'paper', hex: '#F7F2E9', use: 'Page background' },
  { name: 'paper-2', hex: '#FCF9F3', use: 'Cards, dialogs' },
  { name: 'plaster', hex: '#ECE3D5', use: 'Quiet section grounds' },
  { name: 'ink', hex: '#0B1A13', use: 'Body copy, dark panels' },
  { name: 'moss', hex: '#4D6157', use: 'Secondary text, kickers' },
  { name: 'green', hex: '#0C6B45', use: 'Brand primary, links, focus' },
  { name: 'green-deep', hex: '#07452D', use: 'Pressed, dark bands' },
  { name: 'crimson', hex: '#C1121F', use: 'Errors, urgency, label red' },
  { name: 'blue', hex: '#1F6FB2', use: 'Label blue (I)' },
  { name: 'purple', hex: '#6C3FA4', use: 'Label purple (N)' },
  { name: 'orange', hex: '#EE6C22', use: 'Label orange (T)' },
  { name: 'gold', hex: '#DFAE52', use: 'Guarantee badges' },
  { name: 'clay', hex: '#A9553C', use: 'Terracotta accents' },
]

const TYPE_SCALE = [
  { label: 'Display / hero', sample: 'Colour that holds its own', className: 'display text-[clamp(2.4rem,6vw,4.4rem)]' },
  { label: 'Headline / section', sample: 'Palettes with a reason', className: 'display text-[clamp(1.7rem,3.4vw,2.6rem)]' },
  { label: 'Title / card', sample: 'OPUDA’S SILK Emulsion', className: 'font-[var(--font-display)] text-[1.3rem]' },
  { label: 'Body', sample: 'Two coats on a sealed, primed surface. Add a third when changing dramatically between light and dark.', className: 'text-[0.95rem] text-ink/70 max-w-prose' },
  { label: 'Small / meta', sample: 'OP-605 · Purple & Mauve · LRV ≈ 74', className: 'text-[0.75rem] text-ink/60' },
  { label: 'Kicker', sample: 'Colour record', className: 'kicker text-moss' },
]

export default function StyleGuide() {
  const [toggle, setToggle] = useState(true)

  usePageMeta({
    title: 'Design system',
    description: 'The OPUDA’S PAINT design system: colour tokens, type scale, spacing, components and accessibility rules.',
    path: '/style-guide',
  })

  return (
    <>
      <header className="border-b border-ink/10 bg-paper-2/40">
        <div className="shell py-10 sm:py-14">
          <Kicker className="mb-4">Design system · v1.0</Kicker>
          <h1 className="display max-w-3xl text-[clamp(2.2rem,4.6vw,3.6rem)]">
            The system behind the <span className="italic">swatches.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[0.98rem] leading-relaxed text-ink/65">
            One source of truth for colour, type, spacing, motion and controls. Every value here is a CSS custom
            property in <code className="rounded bg-ink/6 px-1 py-0.5 text-[0.82em]">src/styles/theme.css</code>, consumed
            by Tailwind utilities — no ad-hoc hex values in components.
          </p>
        </div>
      </header>

      <div className="shell space-y-14 py-10">
        <section aria-labelledby="colour-title">
          <SectionHead kicker="01 — Colour" title={<span id="colour-title">Tokens</span>} lede="Brand colours are drawn from the printed label; neutrals from the plaster and ochre in the site photography." />
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COLOUR_TOKENS.map((token) => (
              <li key={token.name} className="overflow-hidden rounded-sm border border-ink/12">
                <div className="h-16" style={{ background: token.hex }} />
                <div className="bg-paper-2 p-3">
                  <p className="text-[0.78rem] font-semibold">{token.name}</p>
                  <p className="tabular text-[0.68rem] uppercase text-ink/60">{token.hex}</p>
                  <p className="mt-1 text-[0.68rem] text-ink/60">{token.use}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="type-title">
          <SectionHead kicker="02 — Typography" title={<span id="type-title">Instrument Serif &amp; Archivo</span>} lede="Two voices, both taken from the product. Instrument Serif is the catalogue voice — a tight, high-contrast display face with a real italic, set large and close. Archivo is the tin voice — the signage grotesque that matches the lettering on the pail, carrying labels, tables, forms and every numeral." />
          <div className="mt-6 divide-y divide-ink/10 rounded-sm border border-ink/12">
            {TYPE_SCALE.map((item) => (
              <div key={item.label} className="grid gap-2 p-4 sm:grid-cols-[10rem_1fr]">
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink/60">{item.label}</p>
                <p className={item.className}>{item.sample}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="components-title">
          <SectionHead kicker="03 — Components" title={<span id="components-title">Controls</span>} />
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <p className="kicker mb-3 text-ink/60">Buttons</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button>Primary</Button>
                <Button variant="ink">Ink</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="paper">Paper</Button>
                <Button variant="crimson">Crimson</Button>
                <Button variant="ghost">Ghost</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
              <p className="mt-3 text-[0.72rem] text-ink/60">
                Minimum target 44 × 44 px on touch. Focus is a 2.5 px green ring at 3 px offset, never removed.
              </p>
            </div>

            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <p className="kicker mb-3 text-ink/60">Badges &amp; pills</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="green">Label verified</Badge>
                <Badge tone="gold">5-year guarantee</Badge>
                <Badge tone="ink">Matt</Badge>
                <Badge tone="crimson">Spec in review</Badge>
                <Badge tone="line">Concept</Badge>
              </div>
            </div>

            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <p className="kicker mb-3 text-ink/60">Form controls</p>
              <div className="space-y-3">
                <Field label="Your name" required>
                  {({ id }) => <TextInput id={id} placeholder="Adeola Bakare" />}
                </Field>
                <Field label="Project type" error="Choose the closest project type.">
                  {({ id, invalid, describedBy }) => (
                    <Select id={id} aria-invalid={invalid} aria-describedby={describedBy} defaultValue="">
                      <option value="">Choose one…</option>
                      <option>Whole interior</option>
                    </Select>
                  )}
                </Field>
                <Checkbox label="I agree to the privacy notice" defaultChecked />
                <Toggle checked={toggle} onChange={setToggle} label="Cookie-free mode" description="Local storage only" />
              </div>
            </div>

            <div className="rounded-sm border border-ink/12 bg-paper-2/60 p-5">
              <p className="kicker mb-3 text-ink/60">Spacing &amp; radius</p>
              <div className="space-y-2">
                {[
                  ['space-1', '0.25rem', '4px'],
                  ['space-2', '0.5rem', '8px'],
                  ['space-4', '1rem', '16px'],
                  ['space-6', '1.5rem', '24px'],
                  ['space-10', '2.5rem', '40px'],
                ].map(([name, rem, px]) => (
                  <div key={name} className="flex items-center gap-3 text-[0.74rem]">
                    <span className="w-16 font-semibold">{name}</span>
                    <span className="h-3 bg-green/30" style={{ width: rem }} />
                    <span className="text-ink/60">
                      {rem} · {px}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                {['3px', '6px', '12px', '20px'].map((r) => (
                  <div key={r} className="grid size-12 place-items-center border border-ink/20 text-[0.6rem] text-ink/60" style={{ borderRadius: r }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="rules-title">
          <SectionHead kicker="04 — Rules" title={<span id="rules-title">Non-negotiables</span>} />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ['Colour is never the only signal', 'Every swatch shows its name and code. State changes use text and iconography as well as colour.'],
              ['Focus is always visible', 'Never `outline: none` without an equivalent.'],
              ['Motion is optional', 'All reveals, marquees and transitions collapse under prefers-reduced-motion.'],
              ['Contrast', 'Body text ≥ 4.5:1. Large display text ≥ 3:1. Non-text UI ≥ 3:1.'],
              ['Copy is specific', 'No “premium quality”. Say what the product does, for how long, and under which conditions.'],
              ['Numbers carry provenance', 'A price is a guide price; an LRV is an estimate; a colour is a digital approximation.'],
            ].map(([title, body]) => (
              <li key={title} className="rounded-sm border border-ink/12 bg-paper-2/60 p-4">
                <p className="text-[0.86rem] font-semibold">{title}</p>
                <p className="mt-1 text-[0.8rem] leading-relaxed text-ink/60">{body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/data" variant="outline" size="sm">
              Data provenance
            </ButtonLink>
            <ButtonLink to="/legal/accessibility" variant="outline" size="sm">
              Accessibility statement
            </ButtonLink>
          </div>
        </section>
      </div>
    </>
  )
}
