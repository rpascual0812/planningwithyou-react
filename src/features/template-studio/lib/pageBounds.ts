import type { CanvasElement, TemplatePage } from '../types/schema'

export function isElementVisibleOnPage(
  transform: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number,
): boolean {
  const right = transform.x + transform.width
  const bottom = transform.y + transform.height
  return right > 0 && bottom > 0 && transform.x < pageWidth && transform.y < pageHeight
}

/** Elements on a page, filtered and z-sorted (editor + live). */
export function visiblePageElements(page: TemplatePage): CanvasElement[] {
  return [...page.elements]
    .filter((el) => isElementVisibleOnPage(el.transform, page.width, page.height))
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
}
