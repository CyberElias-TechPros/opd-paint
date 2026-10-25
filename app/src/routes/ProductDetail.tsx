import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Download, FileText, Ruler, ShieldCheck } from 'lucide-react'
import { usePageMeta } from '../lib/seo'
import { PRODUCTS, findProduct, FINISH_SHEEN_LABEL } from '../data/products'
import { COLORS } from '../data/colors'
import { SmartImage } from '../components/media/SmartImage'
import { Badge, DataRow, ArrowLink } from '../components/ui/Bits'
import { Button, ButtonLink } from '../components/ui/Button'
import { ColourCard } from '../components/colour/ColourCard'
import { useApp } from '../store/AppStore'
import { naira } from '../lib/format'
import NotFound from './NotFound'

const SUGGESTED_COLOURS: Record<string, string[]> = {
  matt: ['bone', 'savannah-sand', 'lilac-room', 'sage-whisper', 'mushroom', 'atlantic-blue'],
  silk: ['opuda-white', 'coconut-milk', 'dusty-grape', 'harmattan-sky', 'apricot-wall', 'palm-shadow'],
  gloss: ['graphite', 'window-black', 'opuda-green', 'festival-red'],
  weathershield: ['ivory-coast', 'bone', 'blue-fence', 'terracotta', 'stone-white'],
  primer: ['bone', 'limestone'],
  screeding: ['bone'],
}

export default function ProductDetail() {
  const { id = '' } = useParams()
  const product = findProduct(id)
  const { isProductSaved, toggleProduct } = useApp()

  const suggested = useMemo(() => {
    if (!product) return []
    return (SUGGESTED_COLOURS[product.id] ?? []).map((cid) => COLORS.find((c) => c.id === cid)).filter(Boolean)
  }, [product])

  usePageMeta({
    title: product ? product.name : 'Product not found',
    description: product
      ? `${product.tagline} Coverage ${product.coveragePerUnit} m² per litre per coat, ${product.coatsRecommended} coats, touch dry in ${product.touchDryHours} hours. Pack sizes and technical data.`
      : 'Product not found.',
    path: `/products/${id}`,
    image: product ? `/media/${product.image}.webp` : undefined,
    noIndex: !product,
    jsonLd: product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          sku: product.sku,
          brand: { '@type': 'Brand', name: 'OPUDA’S PAINT' },
          description: product.description,
          offers: product.packs
            .filter((pack) => pack.guidePrice != null)
            .map((pack) => ({
              '@type': 'Offer',
              priceCurrency: 'NGN',
              price: pack.guidePrice,
              name: `${pack.size} ${pack.unit}`,
              availability: 'https://schema.org/InStock',
            })),
        }
      : undefined,
  })

  if (!product) return <NotFound />

  const saved = isProductSaved(product.id)
  const index = PRODUCTS.findIndex((p) => p.id === product.id)
  const next = PRODUCTS[(index + 1) % PRODUCTS.length]

  return (
    <>
      <nav aria-label="Breadcrumb" className="shell pt-6">
        <ol className="flex flex-wrap items-center gap-2 text-[0.72rem] text-ink/60">
          <li>
            <Link to="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/products" className="hover:text-ink">
              Products
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="font-semibold text-ink/70">
            {product.shortName}
          </li>
        </ol>
      </nav>

      <article>
        <section className="shell grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:py-12">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SmartImage
              name={product.image}
              aspect={4 / 3}
              priority
              sizes="(max-width: 1024px) 92vw, 46vw"
              className="rounded-sm"
            />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {product.gallery.slice(0, 3).map((image) => (
                <SmartImage key={image} name={image} aspect={1} sizes="15vw" className="rounded-sm" />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => toggleProduct(product.id)} variant={saved ? 'paper' : 'solid'} aria-pressed={saved}>
                {saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
                {saved ? 'In your project' : 'Add to project'}
              </Button>
              <ButtonLink to={`/calculator?product=${product.id}`} variant="outline">
                <Ruler className="size-4" aria-hidden /> Size my room
              </ButtonLink>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ink">{product.finish}</Badge>
              {product.guaranteeYears ? <Badge tone="gold">{product.guaranteeYears}-year guarantee</Badge> : null}
              <Badge tone={product.claimsStatus === 'label-verified' ? 'green' : 'line'}>
                {product.claimsStatus === 'label-verified' ? 'Claims from label' : 'Spec in review'}
              </Badge>
            </div>
            <h1 className="display mt-4 text-[clamp(2rem,4.4vw,3.4rem)]">{product.name}</h1>
            <p className="mt-3 text-[1.05rem] font-medium leading-relaxed text-ink/75">{product.tagline}</p>
            <p className="mt-4 text-[0.94rem] leading-relaxed text-ink/65">{product.description}</p>

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {product.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-[0.84rem] text-ink/70">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <section className="mt-8" aria-labelledby="packs-title">
              <div className="flex items-baseline justify-between">
                <h2 id="packs-title" className="text-[1.1rem] font-semibold">
                  Pack sizes
                </h2>
                <span className="text-[0.68rem] uppercase tracking-[0.1em] text-ink/60">Guide price · excl. VAT</span>
              </div>
              <div className="mt-3 overflow-hidden rounded-sm border border-ink/12">
                <table className="w-full text-left text-[0.84rem]">
                  <caption className="sr-only">Available pack sizes and indicative prices</caption>
                  <thead className="bg-plaster/40 text-[0.64rem] uppercase tracking-[0.12em] text-ink/60">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-bold">Pack</th>
                      <th scope="col" className="px-4 py-2.5 font-bold">Covers (one coat)</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-bold">Guide price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.packs.map((pack) => (
                      <tr key={pack.size} className="border-t border-ink/8">
                        <th scope="row" className="px-4 py-2.5 font-semibold">
                          {pack.size} {pack.unit}
                        </th>
                        <td className="tabular px-4 py-2.5 text-ink/60">
                          {Math.round(pack.size * product.coveragePerUnit)} m²
                        </td>
                        <td className="tabular px-4 py-2.5 text-right font-semibold">
                          {pack.guidePrice != null ? naira(pack.guidePrice) : 'Ask dealer'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[0.72rem] leading-relaxed text-ink/60">
                Guide prices are indicative Lagos retail figures for the pack shown and are not a quotation. Your dealer
                sets the price you pay.
              </p>
            </section>

            <section className="mt-8" aria-labelledby="tech-title">
              <h2 id="tech-title" className="text-[1.1rem] font-semibold">
                Technical data
              </h2>
              <dl className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <DataRow label="Finish" value={FINISH_SHEEN_LABEL[product.finish]} />
                <DataRow label="Coverage" value={`${product.coveragePerUnit} m² per litre, single coat`} />
                <DataRow label="Recommended coats" value={product.coatsRecommended} />
                <DataRow label="Touch dry" value={`${product.touchDryHours} hours`} />
                <DataRow label="Recoat" value={`${product.recoatHours} hours`} />
                <DataRow label="Full cure" value={`${product.fullCureDays} days`} />
                <DataRow label="Thinning" value={product.dilution} />
                <DataRow label="VOC / base" value={product.voc} />
                <DataRow label="Surfaces" value={product.surfaces.join(', ')} />
                <DataRow label="Best for" value={product.bestFor} />
              </dl>
            </section>

            <section className="mt-8" aria-labelledby="apply-title">
              <h2 id="apply-title" className="text-[1.1rem] font-semibold">
                How it is applied
              </h2>
              <ol className="mt-3 space-y-3">
                {product.application.map((step, stepIndex) => (
                  <li key={step.step} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-green/10 text-[0.62rem] font-bold text-green">
                      {stepIndex + 1}
                    </span>
                    <div>
                      <p className="text-[0.86rem] font-semibold">{step.step}</p>
                      <p className="text-[0.82rem] leading-relaxed text-ink/60">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-8" aria-labelledby="docs-title">
              <h2 id="docs-title" className="text-[1.1rem] font-semibold">
                Documents
              </h2>
              <ul className="mt-2 space-y-2">
                {product.tds.map((doc) => (
                  <li key={doc.href}>
                    <a
                      href={doc.href}
                      className="flex items-center justify-between gap-3 rounded-sm border border-ink/12 bg-paper-2/50 px-4 py-3 text-[0.84rem] font-semibold transition-colors hover:border-ink/35"
                      download
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-ink/60" aria-hidden /> {doc.label}
                      </span>
                      <Download className="size-4 text-ink/60" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ink/12 pt-5">
              <div>
                <p className="text-[0.9rem] font-semibold">Ready to specify it?</p>
                <p className="text-[0.78rem] text-ink/60">Send the room dimensions with your colour and we will quote it.</p>
              </div>
              <ButtonLink to={`/quote?product=${product.id}`} size="sm">
                Request a quote
              </ButtonLink>
            </div>
          </div>
        </section>

        {suggested.length ? (
          <section className="border-t border-ink/10 bg-plaster/30 py-12" aria-labelledby="pairs-title">
            <div className="shell">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 id="pairs-title" className="display text-[1.6rem]">
                    Colours that suit {product.shortName}
                  </h2>
                  <p className="mt-1 text-[0.84rem] text-ink/60">
                    Every colour in the library can be mixed in this product. These are our starting points.
                  </p>
                </div>
                <ArrowLink to="/colours">Library</ArrowLink>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {suggested.map((colour) =>
                  colour ? <ColourCard key={colour.id} colour={colour} height="compact" /> : null,
                )}
              </div>
            </div>
          </section>
        ) : null}

        <nav className="shell flex items-center justify-between gap-4 py-8" aria-label="Product navigation">
          <Link to="/products" className="group inline-flex items-center gap-2 text-[0.8rem] font-semibold hover:text-green">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden /> All products
          </Link>
          <Link to={`/products/${next.id}`} className="group inline-flex items-center gap-2 text-[0.8rem] font-semibold hover:text-green">
            {next.shortName}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </nav>
      </article>
    </>
  )
}
