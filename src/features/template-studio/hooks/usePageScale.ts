import { useLayoutEffect, useState, type RefObject } from 'react'

export type PageScaleOptions = {
  /** Desktop: scale to container width. Mobile: cap at design width. */
  previewMode?: 'desktop' | 'mobile'
  /** Editor zoom multiplier (live/public omit or pass 1). */
  zoom?: number
}

export type PageScaleResult = {
  /** Design pixels → screen pixels (includes zoom when set). */
  scale: number
  /** Base scale from container width only (zoom = 1). */
  pageScale: number
  ready: boolean
}

/**
 * Maps design page width to measured container width.
 * Editor passes zoom; live/public use default zoom 1.
 */
export function usePageScale(
  designWidth: number,
  containerRef: RefObject<HTMLElement | null>,
  options: PageScaleOptions = {},
): PageScaleResult {
  const { previewMode = 'desktop', zoom = 1 } = options
  const [pageScale, setPageScale] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || designWidth <= 0) return

    const update = () => {
      const containerWidth = el.clientWidth
      if (containerWidth <= 0) return
      if (previewMode === 'mobile') {
        const mobileWidth = Math.min(containerWidth, designWidth)
        setPageScale(mobileWidth / designWidth)
      } else {
        setPageScale(containerWidth / designWidth)
      }
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [designWidth, previewMode, containerRef])

  const base = pageScale ?? 1
  return {
    pageScale: base,
    scale: base * zoom,
    ready: pageScale !== null,
  }
}
