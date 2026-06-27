import { useCallback, useEffect, useRef } from 'react'
import { Canvas, IText, type FabricObject } from 'fabric'
import {
  collectTransformSyncTargets,
  commitFabricTextScale,
  createFabricObject,
  fabricElementNeedsRecreate,
  fabricObjectToElementTransform,
  fabricTextTransformPlacement,
  getElementId,
  patchFabricObjectFromElement,
  refreshFabricTextMetricsForElement,
  textTransformPlacementChanged,
} from '../lib/fabricSync'
import { persistDraft } from '../store/templateStudioStore'
import { isElementVisibleOnPage } from '../lib/pageBounds'
import { useTemplateStudioStore } from '../store/templateStudioStore'
import type { CanvasElement, ElementTransform } from '../types/schema'

type UseFabricCanvasOptions = {
  width: number
  height: number
  displayScale: number
  /** Wait for layout measurement before creating the canvas. */
  enabled: boolean
}

/**
 * Binds a Fabric.js canvas to the Zustand document for the active page.
 * Syncs element CRUD and selection both ways.
 */
export function useFabricCanvas({ width, height, displayScale, enabled }: UseFabricCanvasOptions) {
  /** React-owned mount point; Fabric creates/wraps the canvas inside imperatively. */
  const hostRef = useRef<HTMLDivElement | null>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const syncingRef = useRef(false)
  const rebuildTokenRef = useRef(0)
  const syncedGestureRef = useRef(false)
  const transformGestureRef = useRef(false)
  const suppressRebuildUntilRef = useRef(0)
  const displayScaleRef = useRef(displayScale)
  displayScaleRef.current = displayScale

  const canvasRevision = useTemplateStudioStore((s) => s.canvasRevision)

  const isCanvasTransforming = (canvas: Canvas) =>
    Boolean((canvas as Canvas & { _currentTransform?: unknown })._currentTransform)

  const activePage = useTemplateStudioStore((s) => s.getActivePage())
  const elements = activePage.elements
  const showGrid = useTemplateStudioStore((s) => s.showGrid)
  const snapToGrid = useTemplateStudioStore((s) => s.snapToGrid)
  const gridSize = useTemplateStudioStore((s) => s.document.settings.snapGrid)
  const selectedIds = useTemplateStudioStore((s) => s.selectedIds)
  const selectElements = useTemplateStudioStore((s) => s.selectElements)
  const updateElement = useTemplateStudioStore((s) => s.updateElement)
  const updateElementTransform = useTemplateStudioStore((s) => s.updateElementTransform)
  const batchUpdateElementTransforms = useTemplateStudioStore((s) => s.batchUpdateElementTransforms)
  const textSyncInProgressRef = useRef(false)

  const syncTextDimensionsToStore = useCallback(async (scale: number) => {
    const canvas = fabricRef.current
    if (!canvas || textSyncInProgressRef.current) return false

    const pageElements = useTemplateStudioStore.getState().getActivePage().elements
    const updates: Array<{ id: string; transform: Partial<ElementTransform> }> = []

    for (const el of pageElements) {
      if (el.type !== 'text') continue
      const obj = canvas.getObjects().find((o) => getElementId(o) === el.id)
      if (!obj || (obj.type !== 'i-text' && obj.type !== 'IText' && obj.type !== 'text')) {
        continue
      }
      const text = obj as IText
      await refreshFabricTextMetricsForElement(text, el, scale)
      const measured = fabricTextTransformPlacement(text, scale)
      if (!textTransformPlacementChanged(el.transform, measured)) continue
      updates.push({ id: el.id, transform: measured })
    }

    if (!updates.length) return false

    textSyncInProgressRef.current = true
    useTemplateStudioStore.setState({ suppressHistory: true })
    try {
      batchUpdateElementTransforms(updates, { preserveCanvas: true })
    } finally {
      useTemplateStudioStore.setState({ suppressHistory: false })
      textSyncInProgressRef.current = false
    }
    canvas.requestRenderAll()
    return true
  }, [batchUpdateElementTransforms])

  const restoreCanvasSelection = useCallback(async (canvas: Canvas, ids: string[]) => {
    if (ids.length === 1) {
      const target = canvas.getObjects().find((o) => getElementId(o) === ids[0])
      if (target) canvas.setActiveObject(target)
      return
    }
    if (ids.length > 1) {
      const targets = ids
        .map((id) => canvas.getObjects().find((o) => getElementId(o) === id))
        .filter((o): o is FabricObject => Boolean(o))
      if (targets.length) {
        const { ActiveSelection } = await import('fabric')
        canvas.setActiveObject(new ActiveSelection(targets))
      }
    }
  }, [])

  const patchCanvasFromStore = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const scale = Math.max(displayScaleRef.current, 0.01)
    const preserveIds = [...useTemplateStudioStore.getState().selectedIds]
    syncingRef.current = true
    try {
      let textReflowed = false
      for (const el of elements) {
        let obj = canvas.getObjects().find((o) => getElementId(o) === el.id)
        if (!obj) continue
        if (fabricElementNeedsRecreate(obj, el)) {
          const created = await createFabricObject(el, scale)
          if (!created) continue
          const index = canvas.getObjects().indexOf(obj)
          canvas.remove(obj)
          canvas.add(created)
          if (index >= 0) {
            canvas.moveObjectTo(created, index)
          }
          obj = created
          if (el.type === 'text') textReflowed = true
        } else {
          const patched = await patchFabricObjectFromElement(obj, el, scale)
          if (!patched.ok) {
            const created = await createFabricObject(el, scale)
            if (!created) continue
            const index = canvas.getObjects().indexOf(obj)
            canvas.remove(obj)
            canvas.add(created)
            if (index >= 0) {
              canvas.moveObjectTo(created, index)
            }
            if (el.type === 'text') textReflowed = true
          } else if (patched.textReflowed) {
            textReflowed = true
          }
        }
      }
      await restoreCanvasSelection(canvas, preserveIds)
      if (textReflowed) {
        await syncTextDimensionsToStore(scale)
      }
      canvas.requestRenderAll()
    } finally {
      syncingRef.current = false
    }
  }, [elements, restoreCanvasSelection, syncTextDimensionsToStore])

  const rebuildCanvas = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (isCanvasTransforming(canvas)) return
    if (Date.now() < suppressRebuildUntilRef.current) return

    const token = ++rebuildTokenRef.current
    const scale = Math.max(displayScaleRef.current, 0.01)
    syncingRef.current = true
    try {
      canvas.clear()
      canvas.backgroundColor = 'transparent'
      canvas.backgroundImage = undefined

      const sorted = [...elements]
        .filter((el) => isElementVisibleOnPage(el.transform, width, height))
        .sort((a, b) => a.transform.zIndex - b.transform.zIndex)
      for (const el of sorted) {
        if (token !== rebuildTokenRef.current) return
        const obj = await createFabricObject(el, scale)
        if (token !== rebuildTokenRef.current) return
        if (obj) canvas.add(obj)
      }

      if (token !== rebuildTokenRef.current) return

      canvas.setZoom(1)
      canvas.setDimensions({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      })
      canvas.calcOffset()

      await restoreCanvasSelection(
        canvas,
        useTemplateStudioStore.getState().selectedIds,
      )

      if (token !== rebuildTokenRef.current) return
      await syncTextDimensionsToStore(scale)
      canvas.requestRenderAll()
    } finally {
      if (token === rebuildTokenRef.current) {
        syncingRef.current = false
      }
    }
  }, [elements, width, height, restoreCanvasSelection, syncTextDimensionsToStore])

  const scheduleFullRebuild = useCallback(() => {
    void document.fonts.ready.then(() => {
      if (!fabricRef.current || !enabled) return
      if (useTemplateStudioStore.getState().suppressFabricRebuild) return
      void rebuildCanvas()
    })
  }, [enabled, rebuildCanvas])

  const scheduleFullRebuildRef = useRef(scheduleFullRebuild)
  scheduleFullRebuildRef.current = scheduleFullRebuild

  useEffect(() => {
    const host = hostRef.current
    if (!enabled || !host) return

    const el = document.createElement('canvas')
    el.className = 'ts-fabric-canvas'
    host.appendChild(el)

    const scale = Math.max(displayScaleRef.current, 0.01)
    const canvas = new Canvas(el, {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      preserveObjectStacking: true,
      selection: true,
      enableRetinaScaling: true,
    })
    fabricRef.current = canvas

    const onSelection = () => {
      if (syncingRef.current) return
      const active = canvas.getActiveObjects()
      const ids = active.map(getElementId).filter((id): id is string => Boolean(id))
      selectElements(ids)
    }

    const finishTransformSync = () => {
      suppressRebuildUntilRef.current = Date.now() + 250
      useTemplateStudioStore.setState({
        suppressHistory: false,
        suppressFabricRebuild: true,
        isDirty: true,
      })
      useTemplateStudioStore.getState().pushHistorySnapshot()
      window.setTimeout(() => {
        useTemplateStudioStore.setState({ suppressFabricRebuild: false })
      }, 280)
    }

    const syncTargetToStore = async (raw?: FabricObject) => {
      if (syncingRef.current) return
      const seed = raw ?? canvas.getActiveObject()
      if (!seed) return
      const targets = collectTransformSyncTargets(seed)
      if (!targets.length) return

      syncedGestureRef.current = true
      useTemplateStudioStore.setState({
        suppressHistory: true,
        suppressFabricRebuild: true,
      })

      syncingRef.current = true
      let synced = 0
      try {
        for (const target of targets) {
          const isText =
            target.type === 'i-text' ||
            target.type === 'text' ||
            target.type === 'IText'

          let scaledStyle: { fontSize: number; charSpacing: number } | null = null
          if (isText) {
            scaledStyle = await commitFabricTextScale(
              target as IText,
              displayScaleRef.current,
            )
          }

          const mapped = fabricObjectToElementTransform(
            target,
            displayScaleRef.current,
            gridSize,
            snapToGrid,
          )
          if (!mapped) continue
          synced += 1

          if (isText) {
            const el = useTemplateStudioStore
              .getState()
              .getActivePage()
              .elements.find((e) => e.id === mapped.id)
            if (el?.type === 'text') {
              updateElement(mapped.id, {
                transform: mapped.transform,
                content: (target as IText).text ?? '',
                style: scaledStyle
                  ? { ...el.style, ...scaledStyle }
                  : el.style,
              } as Partial<CanvasElement>)
              continue
            }
          }

          updateElementTransform(mapped.id, mapped.transform)
        }
      } finally {
        syncingRef.current = false
      }
      if (!synced) return

      persistDraft(useTemplateStudioStore.getState().document)
      finishTransformSync()
      canvas.requestRenderAll()
    }

    const onModified = (e: { target?: FabricObject }) => {
      if (!e.target) return
      void syncTargetToStore(e.target)
    }

    const onMouseDown = () => {
      syncedGestureRef.current = false
      transformGestureRef.current = false
    }

    const onTransformStart = () => {
      transformGestureRef.current = true
      suppressRebuildUntilRef.current = Date.now() + 500
    }

    const onMouseUp = () => {
      const wasTransforming = transformGestureRef.current
      transformGestureRef.current = false
      if (!wasTransforming) return
      if (syncedGestureRef.current) return
      void syncTargetToStore()
    }

    canvas.on('selection:created', onSelection)
    canvas.on('selection:updated', onSelection)
    canvas.on('selection:cleared', () => {
      if (syncingRef.current) return
      selectElements([])
    })
    canvas.on('mouse:down', onMouseDown)
    canvas.on('object:moving', onTransformStart)
    canvas.on('object:scaling', onTransformStart)
    canvas.on('object:rotating', onTransformStart)
    canvas.on('object:modified', onModified)
    canvas.on('mouse:up', onMouseUp)

    scheduleFullRebuildRef.current()

    return () => {
      canvas.dispose()
      fabricRef.current = null
      host.replaceChildren()
    }
  }, [width, height, enabled, gridSize, snapToGrid, selectElements, updateElement, updateElementTransform, syncTextDimensionsToStore])

  useEffect(() => {
    if (!enabled || !fabricRef.current) return
    scheduleFullRebuild()
  }, [enabled, scheduleFullRebuild, displayScale])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !enabled) return
    canvas.calcOffset()
    canvas.requestRenderAll()
  }, [enabled, displayScale, width, height])

  useEffect(() => {
    if (!enabled || !fabricRef.current) return
    if (Date.now() < suppressRebuildUntilRef.current) return

    if (useTemplateStudioStore.getState().suppressFabricRebuild) {
      void patchCanvasFromStore().then(() => {
        useTemplateStudioStore.setState({ suppressFabricRebuild: false })
      })
      return
    }

    scheduleFullRebuild()
  }, [enabled, scheduleFullRebuild, patchCanvasFromStore, elements, canvasRevision])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || syncingRef.current || isCanvasTransforming(canvas)) return
    if (useTemplateStudioStore.getState().suppressFabricRebuild) return
    const objs = canvas.getObjects()
    for (const obj of objs) {
      const id = getElementId(obj)
      obj.set('opacity', selectedIds.includes(id ?? '') ? 1 : obj.opacity)
    }
    void restoreCanvasSelection(canvas, selectedIds).then(() => {
      if (!selectedIds.length) {
        canvas.discardActiveObject()
      }
      canvas.requestRenderAll()
    })
  }, [selectedIds, restoreCanvasSelection])

  return {
    hostRef,
    showGrid,
    gridSize,
    fabricCanvas: fabricRef,
  }
}
