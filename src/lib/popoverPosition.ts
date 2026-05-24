export type AnchorRect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

const GAP = 8
const VIEW_PADDING = 8

export function toAnchorRect(rect: DOMRectReadOnly): AnchorRect {
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

export function computePopoverPosition(
  anchor: AnchorRect,
  popoverW: number,
  popoverH: number,
  viewportW: number,
  viewportH: number,
): { top: number; left: number } {
  const spaceBelow = viewportH - anchor.bottom - GAP - VIEW_PADDING
  const spaceAbove = anchor.top - GAP - VIEW_PADDING
  const spaceRight = viewportW - anchor.right - GAP - VIEW_PADDING
  const spaceLeft = anchor.left - GAP - VIEW_PADDING

  let top = 0
  let left = 0

  const preferBelow =
    spaceBelow >= popoverH ||
    (spaceBelow >= spaceAbove && spaceBelow >= Math.min(spaceLeft, spaceRight))

  if (preferBelow && spaceBelow >= popoverH) {
    top = anchor.bottom + GAP
    left = anchor.left + anchor.width / 2 - popoverW / 2
  } else if (spaceAbove >= popoverH) {
    top = anchor.top - GAP - popoverH
    left = anchor.left + anchor.width / 2 - popoverW / 2
  } else if (spaceRight >= popoverW) {
    left = anchor.right + GAP
    top = anchor.top + anchor.height / 2 - popoverH / 2
  } else if (spaceLeft >= popoverW) {
    left = anchor.left - GAP - popoverW
    top = anchor.top + anchor.height / 2 - popoverH / 2
  } else {
    top = anchor.bottom + GAP
    left = anchor.left + anchor.width / 2 - popoverW / 2
  }

  left = Math.max(VIEW_PADDING, Math.min(left, viewportW - popoverW - VIEW_PADDING))
  top = Math.max(VIEW_PADDING, Math.min(top, viewportH - popoverH - VIEW_PADDING))

  return { top, left }
}
