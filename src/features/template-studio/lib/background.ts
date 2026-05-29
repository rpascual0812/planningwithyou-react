import type { CSSProperties } from 'react'
import type { PageBackground } from '../types/schema'

/** CSS background for editor preview wrapper (not Fabric canvas fill). */
export function backgroundToCss(bg: PageBackground): CSSProperties {
  const style: CSSProperties = {}
  if (bg.type === 'solid' && bg.color) {
    style.backgroundColor = bg.color
  } else if (bg.type === 'gradient' && bg.gradient) {
    const stops = bg.gradient.stops
      .map((s) => `${s.color} ${s.offset * 100}%`)
      .join(', ')
    style.background = `linear-gradient(${bg.gradient.angle}deg, ${stops})`
  } else if (bg.type === 'image' && bg.imageUrl) {
    style.backgroundImage = `url(${bg.imageUrl})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }
  if (bg.overlayColor && (bg.overlayOpacity ?? 0) > 0) {
    style.boxShadow = `inset 0 0 0 9999px ${hexWithAlpha(bg.overlayColor, bg.overlayOpacity ?? 0.3)}`
  }
  if (bg.blur && bg.blur > 0) {
    style.filter = `blur(${bg.blur}px)`
  }
  return style
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  if (hex.startsWith('#') && hex.length === 7) return `${hex}${a}`
  return hex
}

/** Legacy Fabric fill when a canvas needs an opaque fallback. */
export function backgroundCanvasColor(bg: PageBackground): string {
  if (bg.type === 'solid' && bg.color) return bg.color
  if (bg.type === 'gradient' && bg.gradient?.stops[0]) {
    return bg.gradient.stops[0].color
  }
  return '#ffffff'
}
