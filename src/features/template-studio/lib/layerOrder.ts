import type { CanvasElement } from '../types/schema'

export type LayerDirection = 'forward' | 'backward' | 'front' | 'back'

export function maxZIndex(elements: CanvasElement[]): number {
  if (!elements.length) return 0
  return Math.max(...elements.map((el) => el.transform.zIndex))
}

/** zIndex one above every element on the page (for newly inserted content). */
export function frontZIndexForNewElement(elements: CanvasElement[]): number {
  return maxZIndex(elements) + 1
}

/** Reorder page elements and assign consecutive zIndex values (1 = back). */
export function reorderElementsByLayer(
  elements: CanvasElement[],
  selectedIds: string[],
  direction: LayerDirection,
): CanvasElement[] {
  const ids = new Set(selectedIds)
  if (!ids.size) return elements

  const sorted = [...elements].sort((a, b) => a.transform.zIndex - b.transform.zIndex)
  const selected = sorted.filter((el) => ids.has(el.id))
  if (!selected.length) return elements

  const unselected = sorted.filter((el) => !ids.has(el.id))
  let order: CanvasElement[]

  switch (direction) {
    case 'front':
      order = [...unselected, ...selected]
      break
    case 'back':
      order = [...selected, ...unselected]
      break
    case 'forward': {
      order = [...sorted]
      for (let i = order.length - 2; i >= 0; i--) {
        if (ids.has(order[i].id) && !ids.has(order[i + 1].id)) {
          ;[order[i], order[i + 1]] = [order[i + 1], order[i]]
        }
      }
      break
    }
    case 'backward': {
      order = [...sorted]
      for (let i = 1; i < order.length; i++) {
        if (ids.has(order[i].id) && !ids.has(order[i - 1].id)) {
          ;[order[i], order[i - 1]] = [order[i - 1], order[i]]
        }
      }
      break
    }
  }

  order.forEach((el, index) => {
    el.transform.zIndex = index + 1
  })
  return order
}
