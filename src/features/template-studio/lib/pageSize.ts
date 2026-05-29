import type { ElementTransform } from '../types/schema'

/** Design artboard aspect ratio (width : height). */
export const PAGE_ASPECT_RATIO = 16 / 9

export function pageSizeForAspect(baseWidth: number): { width: number; height: number } {
  return {
    width: baseWidth,
    height: Math.round((baseWidth * 9) / 16),
  }
}

/** Default 16:9 design canvas (scales to any viewport width). */
export const DEFAULT_PAGE_SIZE = pageSizeForAspect(1280)

/** Previous portrait default — used to rescale bundled sample content. */
export const LEGACY_PAGE_SIZE = { width: 390, height: 844 }

const SCALE_X = DEFAULT_PAGE_SIZE.width / LEGACY_PAGE_SIZE.width
const SCALE_Y = DEFAULT_PAGE_SIZE.height / LEGACY_PAGE_SIZE.height

export function scaleFontFromLegacy(fontSize: number): number {
  return Math.round(fontSize * SCALE_X)
}

/** Map element boxes from the old 390×844 layout onto the 16:9 canvas. */
export function scaleLayoutFromLegacy(
  partial: Partial<ElementTransform> & Pick<ElementTransform, 'width' | 'height'>,
): ElementTransform {
  return {
    x: Math.round((partial.x ?? 0) * SCALE_X),
    y: Math.round((partial.y ?? 0) * SCALE_Y),
    width: Math.round(partial.width * SCALE_X),
    height: Math.round(partial.height * SCALE_Y),
    rotation: partial.rotation ?? 0,
    scaleX: partial.scaleX ?? 1,
    scaleY: partial.scaleY ?? 1,
    opacity: partial.opacity ?? 1,
    zIndex: partial.zIndex ?? 1,
    locked: partial.locked ?? false,
  }
}
