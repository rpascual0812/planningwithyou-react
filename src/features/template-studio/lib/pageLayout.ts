import type { CSSProperties } from 'react'
import type { ElementTransform } from '../types/schema'

function transformStyle(
  t: ElementTransform,
  pageScale: number,
): CSSProperties {
  const s = pageScale
  const scale =
    t.scaleX !== 1 || t.scaleY !== 1 ? ` scale(${t.scaleX}, ${t.scaleY})` : ''
  const rotate = t.rotation ? ` rotate(${t.rotation}deg)` : ''
  return {
    position: 'absolute',
    left: t.x * s,
    top: t.y * s,
    width: t.width * s,
    height: t.height * s,
    transform: `${rotate}${scale}`.trim() || undefined,
    transformOrigin: 'top left',
    opacity: t.opacity,
    zIndex: t.zIndex,
    boxSizing: 'border-box',
  }
}

/** Padding-bottom % for aspect-ratio viewport (height / width). */
export function pageAspectPaddingPercent(pageWidth: number, pageHeight: number): string {
  if (pageWidth <= 0) return '100%'
  return `${(pageHeight / pageWidth) * 100}%`
}

/** Scaled page size in screen pixels (matches Fabric canvas dimensions). */
export function scaledPageSize(
  pageWidth: number,
  pageHeight: number,
  scale: number,
): { width: number; height: number } {
  return {
    width: pageWidth * scale,
    height: pageHeight * scale,
  }
}

/** Absolute box in container pixels (design coords × page scale, same as Fabric). */
export function designPixelStyle(t: ElementTransform, pageScale: number): CSSProperties {
  return transformStyle(t, pageScale)
}

/** Text box matches Fabric IText frame (fixed height, clipped like editor canvas). */
export function designTextStyle(t: ElementTransform, pageScale: number): CSSProperties {
  return {
    ...transformStyle(t, pageScale),
    overflow: 'hidden',
  }
}
