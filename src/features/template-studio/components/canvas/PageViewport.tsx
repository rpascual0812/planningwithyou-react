import type { CSSProperties, ReactNode } from 'react'
import { backgroundToCss } from '../../lib/background'
import { pageAspectPaddingPercent, scaledPageSize } from '../../lib/pageLayout'
import type { PageBackground } from '../../types/schema'

type PageViewportProps = {
  pageWidth: number
  pageHeight: number
  background: PageBackground
  scale: number
  ready: boolean
  /** Desktop/live: 100% width + aspect ratio. Mobile editor: fixed pixel width. */
  layout?: 'fluid' | 'fixed'
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Fixed artboard viewport: design page scaled to container width.
 * Used by editor and live so positions match 1:1 at the same container width.
 */
const PageViewport = ({
  pageWidth,
  pageHeight,
  background,
  scale,
  ready,
  layout = 'fluid',
  className = '',
  style,
  children,
}: PageViewportProps) => {
  const { width, height } = scaledPageSize(pageWidth, pageHeight, scale)
  const isFluid = layout === 'fluid'

  const viewportStyle: CSSProperties = {
    ...(isFluid
      ? { paddingBottom: pageAspectPaddingPercent(pageWidth, pageHeight) }
      : { width, height }),
    ...backgroundToCss(background),
    ...style,
  }

  const canvasStyle: CSSProperties = {
    width,
    height,
    visibility: ready ? 'visible' : 'hidden',
  }

  return (
    <div
      className={`pwy-page-viewport${isFluid ? '' : ' pwy-page-viewport--fixed-width'} ${className}`.trim()}
      style={viewportStyle}
    >
      <div className="pwy-page-canvas" style={canvasStyle}>
        {children}
      </div>
    </div>
  )
}

export default PageViewport
