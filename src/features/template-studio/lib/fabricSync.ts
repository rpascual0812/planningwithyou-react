import {
  FabricImage,
  IText,
  Pattern,
  Rect,
  type FabricObject,
  type TMat2D,
} from 'fabric'
import type { CanvasElement, ElementTransform, ImageElement, TextElement } from '../types/schema'

export const FABRIC_ELEMENT_ID = 'elementId'
export const FABRIC_ELEMENT_TYPE = 'elementType'

/** Pattern matrix for object-fit inside a fixed box (box coords, origin top-left). */
export function imagePatternTransform(
  naturalWidth: number,
  naturalHeight: number,
  boxW: number,
  boxH: number,
  objectFit: ImageElement['style']['objectFit'],
): TMat2D {
  const nw = naturalWidth || 1
  const nh = naturalHeight || 1

  if (objectFit === 'fill') {
    return [boxW / nw, 0, 0, boxH / nh, 0, 0]
  }

  const scale =
    objectFit === 'cover'
      ? Math.max(boxW / nw, boxH / nh)
      : Math.min(boxW / nw, boxH / nh)
  const scaledW = nw * scale
  const scaledH = nh * scale
  return [scale, 0, 0, scale, (boxW - scaledW) / 2, (boxH - scaledH) / 2]
}

export function snapValue(value: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return value
  return Math.round(value / grid) * grid
}

export function transformToFabricProps(t: ElementTransform, displayScale = 1) {
  const s = displayScale
  return {
    left: t.x * s,
    top: t.y * s,
    width: t.width * s,
    height: t.height * s,
    angle: t.rotation,
    scaleX: t.scaleX,
    scaleY: t.scaleY,
    opacity: t.opacity,
    originX: 'left' as const,
    originY: 'top' as const,
  }
}

/** Resolve Fabric modified target (groups are stored on the group, not activeSelection). */
export function resolveFabricModifiedTarget(obj: FabricObject): FabricObject | null {
  if (obj.type === 'activeSelection' || obj.type === 'ActiveSelection') {
    const objects = (
      obj as FabricObject & { getObjects?: () => FabricObject[] }
    ).getObjects?.()
    if (objects?.length === 1) return objects[0]
    return null
  }
  return obj
}

/** All document-backed objects to sync after a drag/transform (including multi-select). */
export function collectTransformSyncTargets(obj: FabricObject): FabricObject[] {
  const single = resolveFabricModifiedTarget(obj)
  if (single) return [single]

  if (obj.type === 'activeSelection' || obj.type === 'ActiveSelection') {
    const objects = (
      obj as FabricObject & { getObjects?: () => FabricObject[] }
    ).getObjects?.()
    return (objects ?? []).filter((o) => Boolean(getElementId(o)))
  }

  const id = getElementId(obj)
  return id ? [obj] : []
}

export function fabricPropsToTransform(obj: FabricObject, displayScale = 1): ElementTransform {
  const s = displayScale || 1
  obj.setCoords()

  const scaleX = obj.scaleX ?? 1
  const scaleY = obj.scaleY ?? 1
  const zIndex = (obj.get('data') as { zIndex?: number })?.zIndex ?? 1
  const locked = Boolean(obj.lockMovementX && obj.lockMovementY)

  if (obj.type === 'Group') {
    return {
      x: (obj.left ?? 0) / s,
      y: (obj.top ?? 0) / s,
      width: ((obj.width ?? 0) * scaleX) / s,
      height: ((obj.height ?? 0) * scaleY) / s,
      rotation: obj.angle ?? 0,
      scaleX: 1,
      scaleY: 1,
      opacity: obj.opacity ?? 1,
      zIndex,
      locked,
    }
  }

  // Use object geometry (top-left origin), not axis-aligned bounding box — the latter
  // disagrees with our CSS/Fabric placement when rotated or for some text metrics.
  const width =
    typeof obj.getScaledWidth === 'function'
      ? obj.getScaledWidth()
      : (obj.width ?? 0) * scaleX
  const height =
    typeof obj.getScaledHeight === 'function'
      ? obj.getScaledHeight()
      : (obj.height ?? 0) * scaleY

  return {
    x: (obj.left ?? 0) / s,
    y: (obj.top ?? 0) / s,
    width: width / s,
    height: height / s,
    rotation: obj.angle ?? 0,
    scaleX: 1,
    scaleY: 1,
    opacity: obj.opacity ?? 1,
    zIndex,
    locked,
  }
}

/** Write Fabric object geometry into the document store (for hooks). */
export function fabricObjectToElementTransform(
  obj: FabricObject,
  displayScale: number,
  gridSize: number,
  snapToGrid: boolean,
): { id: string; transform: ElementTransform } | null {
  const target = resolveFabricModifiedTarget(obj) ?? (getElementId(obj) ? obj : null)
  if (!target) return null
  const id = getElementId(target)
  if (!id) return null
  const t = fabricPropsToTransform(target, displayScale)
  return {
    id,
    transform: {
      ...t,
      x: snapValue(t.x, gridSize, snapToGrid),
      y: snapValue(t.y, gridSize, snapToGrid),
    },
  }
}

export async function createFabricObject(
  element: CanvasElement,
  displayScale = 1,
): Promise<FabricObject | null> {
  const s = displayScale
  const base = {
    ...transformToFabricProps(element.transform, s),
    selectable: !element.transform.locked,
    evented: !element.transform.locked,
    data: { elementId: element.id, elementType: element.type, zIndex: element.transform.zIndex },
  }

  switch (element.type) {
    case 'text': {
      const text = new IText(element.content, {
        ...base,
        fontFamily: element.style.fontFamily,
        fontSize: element.style.fontSize * s,
        fill: element.style.fill,
        fontWeight: element.style.fontWeight,
        fontStyle: element.style.fontStyle,
        underline: element.style.underline,
        charSpacing: element.style.charSpacing * s,
        textAlign: element.style.textAlign,
        lineHeight: element.style.lineHeight,
      })
      return text
    }
    case 'image': {
      if (!element.src) {
        return placeholderRect(element, 'Image', displayScale)
      }
      try {
        const t = element.transform
        const boxW = t.width * s
        const boxH = t.height * s
        const fabricImg = await FabricImage.fromURL(
          element.src,
          element.src.startsWith('blob:') ? {} : { crossOrigin: 'anonymous' },
        )
        const nw = fabricImg.width ?? 1
        const nh = fabricImg.height ?? 1
        const source = fabricImg.getElement()
        const radius = element.style.borderRadius * s
        const pattern = new Pattern({
          source,
          repeat: 'no-repeat',
          crossOrigin: element.src.startsWith('blob:') ? '' : 'anonymous',
          patternTransform: imagePatternTransform(
            nw,
            nh,
            boxW,
            boxH,
            element.style.objectFit,
          ),
        })

        return new Rect({
          left: t.x * s,
          top: t.y * s,
          width: boxW,
          height: boxH,
          scaleX: 1,
          scaleY: 1,
          angle: t.rotation,
          opacity: t.opacity,
          originX: 'left',
          originY: 'top',
          fill: pattern,
          strokeWidth: 0,
          rx: radius,
          ry: radius,
          selectable: !t.locked,
          evented: !t.locked,
          data: {
            elementId: element.id,
            elementType: element.type,
            zIndex: t.zIndex,
            imageSrc: element.src,
            imageObjectFit: element.style.objectFit,
          },
        })
      } catch {
        return placeholderRect(element, 'Image', displayScale)
      }
    }
    case 'video':
      return placeholderRect(element, 'Video', displayScale, 'rgba(0,0,0,0)', '#6c757d', true)
    case 'map':
      return placeholderRect(element, 'Map', displayScale, 'rgba(0,0,0,0)', '#2d6a8f', true)
    case 'shape': {
      return new Rect({
        ...base,
        fill: element.fill,
        stroke: element.stroke,
        strokeWidth: element.strokeWidth * s,
        rx:
          element.shape === 'circle'
            ? (Math.min(element.transform.width, element.transform.height) / 2) * s
            : 0,
      })
    }
    case 'countdown':
    case 'rsvp':
      return placeholderRect(element, element.type, displayScale, 'rgba(0,0,0,0)', '#c4b5a0', true)
    case 'music':
    case 'gallery':
      return widgetPlaceholder(element, displayScale)
    default:
      return null
  }
}

function placeholderRect(
  element: CanvasElement,
  _label: string,
  displayScale = 1,
  fill = '#f0ebe3',
  stroke = '#c4b5a0',
  dashed = false,
): Rect {
  return new Rect({
    ...transformToFabricProps(element.transform, displayScale),
    fill,
    stroke,
    strokeWidth: dashed ? 1 : 1,
    strokeDashArray: dashed ? [6, 4] : undefined,
    selectable: !element.transform.locked,
    evented: !element.transform.locked,
    data: { elementId: element.id, elementType: element.type, zIndex: element.transform.zIndex },
    opacity: element.transform.opacity,
  })
}

function widgetPlaceholder(element: CanvasElement, displayScale = 1): FabricObject {
  return placeholderRect(element, element.type, displayScale)
}

export function getElementId(obj: FabricObject): string | undefined {
  const data = obj.get('data') as { elementId?: string } | undefined
  return data?.elementId
}

export function applyTextStyleToFabric(
  text: IText,
  el: TextElement,
  displayScale = 1,
) {
  const s = displayScale
  text.set({
    fontFamily: el.style.fontFamily,
    fontSize: el.style.fontSize * s,
    fill: el.style.fill,
    fontWeight: el.style.fontWeight,
    fontStyle: el.style.fontStyle,
    underline: el.style.underline,
    charSpacing: el.style.charSpacing * s,
    textAlign: el.style.textAlign,
    lineHeight: el.style.lineHeight,
  })
}

function fabricImageNeedsRecreate(obj: FabricObject, element: ImageElement): boolean {
  const data = obj.get('data') as { imageSrc?: string; imageObjectFit?: string } | undefined
  return (
    data?.imageSrc !== element.src || data?.imageObjectFit !== element.style.objectFit
  )
}

/** Update an existing Fabric object from the document (avoids full canvas clear). */
export function patchFabricObjectFromElement(
  obj: FabricObject,
  element: CanvasElement,
  displayScale = 1,
): boolean {
  const s = displayScale
  const t = transformToFabricProps(element.transform, s)
  obj.set({
    ...t,
    opacity: element.transform.opacity,
    selectable: !element.transform.locked,
    evented: !element.transform.locked,
    data: {
      ...(obj.get('data') as object),
      elementId: element.id,
      elementType: element.type,
      zIndex: element.transform.zIndex,
    },
  })

  if (element.type === 'text') {
    const text = obj as IText
    if (text.type !== 'i-text' && text.type !== 'IText' && text.type !== 'text') {
      return false
    }
    text.set({ text: element.content })
    applyTextStyleToFabric(text, element, s)
    text.setCoords()
    return true
  }

  if (element.type === 'shape' && obj.type === 'rect') {
    const rect = obj as Rect
    rect.set({
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth * s,
      rx:
        element.shape === 'circle'
          ? (Math.min(element.transform.width, element.transform.height) / 2) * s
          : 0,
      ry:
        element.shape === 'circle'
          ? (Math.min(element.transform.width, element.transform.height) / 2) * s
          : 0,
    })
    obj.setCoords()
    return true
  }

  if (element.type === 'image' && obj.type === 'rect') {
    const rect = obj as Rect
    rect.set({
      rx: element.style.borderRadius * s,
      ry: element.style.borderRadius * s,
    })
    obj.setCoords()
    return !fabricImageNeedsRecreate(obj, element)
  }

  obj.setCoords()
  return true
}

export function fabricElementNeedsRecreate(
  obj: FabricObject,
  element: CanvasElement,
): boolean {
  return element.type === 'image' && fabricImageNeedsRecreate(obj, element as ImageElement)
}
