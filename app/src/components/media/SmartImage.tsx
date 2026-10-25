import { useState } from 'react'
import { cn } from '../../lib/cn'
import { ALT, getImage } from '../../lib/media'

/**
 * Photography wrapper.
 *
 * Every image in the site is served from the manifest produced by
 * tools/build-media.py, which gives us three things a raw <img> does not:
 *   • a correctly sized thumbnail for narrow viewports and card grids;
 *   • an inline blurred placeholder in the average colour of the photo, so the
 *     layout never reflows and there is no white flash;
 *   • intrinsic width/height, which reserves space before the bytes arrive
 *     (protects CLS — see performance budget in the README).
 */
export function SmartImage({
  name,
  alt,
  className,
  imgClassName,
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority,
  aspect,
  objectPosition,
  overlay,
  children,
}: {
  name: string
  alt?: string
  className?: string
  imgClassName?: string
  sizes?: string
  priority?: boolean
  /** Override the natural aspect ratio (width / height). */
  aspect?: number
  objectPosition?: string
  overlay?: string
  children?: React.ReactNode
}) {
  const image = getImage(name)
  const [loaded, setLoaded] = useState(false)
  const ratio = aspect ?? (image.aspect || 1)
  const description = alt ?? ALT[name] ?? ''

  return (
    <div
      className={cn('relative overflow-hidden bg-plaster', className)}
      style={{
        aspectRatio: ratio,
        backgroundColor: image.tint,
        backgroundImage: image.lqip ? `url(${image.lqip})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <picture>
        <source media="(max-width: 720px)" srcSet={image.thumb} />
        <img
          src={image.src}
          alt={description}
          width={image.width}
          height={image.height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          sizes={sizes}
          onLoad={() => setLoaded(true)}
          className={cn(
            'size-full object-cover transition-[opacity,transform] duration-[900ms] ease-[var(--ease-out-quint)]',
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
          style={{ objectPosition }}
        />
      </picture>
      {overlay ? <div aria-hidden className={cn('pointer-events-none absolute inset-0', overlay)} /> : null}
      {children}
    </div>
  )
}
