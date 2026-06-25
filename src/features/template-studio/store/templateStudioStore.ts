import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { createBlankDocument } from '../lib/blankDocument'
import { SAMPLE_WEDDING_TEMPLATE } from '../lib/sampleWeddingTemplate'
import { normalizeDocumentMeta } from '../lib/templateSerializer'
import { newElementId, newPageId } from '../lib/ids'
import { frontZIndexForNewElement, reorderElementsByLayer, type LayerDirection } from '../lib/layerOrder'
import type {
  CanvasElement,
  ElementTransform,
  PageBackground,
  TemplatePage,
  WeddingTemplateDocument,
} from '../types/schema'
import { DEFAULT_PAGE_SIZE } from '../types/schema'

const HISTORY_LIMIT = 50
const AUTOSAVE_KEY = 'template-studio:draft'

const INITIAL_DOCUMENT = createBlankDocument()

function cloneDoc(doc: WeddingTemplateDocument): WeddingTemplateDocument {
  return structuredClone(doc)
}

function activePageFromDoc(doc: WeddingTemplateDocument, pageId: string): TemplatePage {
  const page = doc.pages.find((p) => p.id === pageId)
  if (!page) return doc.pages[0]
  return page
}

type PreviewMode = 'desktop' | 'mobile'
export type RightPanelTab = 'properties' | 'animation' | 'ai-themes'

export type TemplateStudioState = {
  document: WeddingTemplateDocument
  savedTemplateId: number | null
  savedSlug: string | null
  isPublished: boolean
  activePageId: string
  selectedIds: string[]
  zoom: number
  showGrid: boolean
  snapToGrid: boolean
  previewMode: PreviewMode
  rightPanelTab: RightPanelTab
  marketplaceOpen: boolean
  isDirty: boolean
  lastSavedAt: string | null
  past: WeddingTemplateDocument[]
  future: WeddingTemplateDocument[]
  /** Suppress history push during Fabric sync */
  suppressHistory: boolean
  /** Skip full canvas rebuild while Fabric writes transforms back to the store */
  suppressFabricRebuild: boolean
  /** Bumped when the document is replaced (load template, blank canvas) to refresh Fabric */
  canvasRevision: number
  /** RSVP form editor modal — element id on canvas */
  rsvpFormEditorId: string | null

  getActivePage: () => TemplatePage
  setDocument: (doc: WeddingTemplateDocument, opts?: { pushHistory?: boolean }) => void
  updateDocumentMeta: (patch: Partial<WeddingTemplateDocument['meta']>) => void
  loadFromRecord: (record: {
    id: number
    title: string
    slug: string
    document: WeddingTemplateDocument
    is_published: boolean
  }) => void
  clearSavedRecord: () => void
  setSavedRecord: (record: {
    id: number
    slug: string
    is_published: boolean
  }) => void
  openBlankCanvas: () => void
  loadSampleTemplate: () => void
  setActivePageId: (id: string) => void
  addPage: (name: string, sectionType?: TemplatePage['sectionType']) => void
  updatePageBackground: (background: PageBackground) => void
  updatePageMeta: (patch: Partial<Pick<TemplatePage, 'name' | 'slug' | 'transition'>>) => void
  selectElements: (ids: string[]) => void
  clearSelection: () => void
  addElement: (element: CanvasElement) => void
  updateElement: (
    id: string,
    patch: Partial<CanvasElement>,
    opts?: { preserveCanvas?: boolean },
  ) => void
  updateElementTransform: (id: string, transform: Partial<ElementTransform>) => void
  batchUpdateElementTransforms: (
    updates: Array<{ id: string; transform: Partial<ElementTransform> }>,
    opts?: { preserveCanvas?: boolean },
  ) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  layerSelected: (direction: LayerDirection) => void
  setZoom: (zoom: number) => void
  setShowGrid: (v: boolean) => void
  setSnapToGrid: (v: boolean) => void
  setPreviewMode: (mode: PreviewMode) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setMarketplaceOpen: (open: boolean) => void
  undo: () => void
  redo: () => void
  markSaved: () => void
  pushHistorySnapshot: () => void
  openRsvpFormEditor: (elementId: string) => void
  closeRsvpFormEditor: () => void
}

function pushPast(state: TemplateStudioState): Pick<TemplateStudioState, 'past' | 'future'> {
  const snap = cloneDoc(state.document)
  const past = [...state.past, snap].slice(-HISTORY_LIMIT)
  return { past, future: [] }
}

export const useTemplateStudioStore = create<TemplateStudioState>()(
  subscribeWithSelector((set, get) => ({
    document: INITIAL_DOCUMENT,
    savedTemplateId: null,
    savedSlug: null,
    isPublished: false,
    activePageId: INITIAL_DOCUMENT.pages[0]!.id,
    selectedIds: [],
    zoom: 1,
    showGrid: true,
    snapToGrid: true,
    previewMode: 'desktop',
    rightPanelTab: 'properties',
    marketplaceOpen: false,
    isDirty: false,
    lastSavedAt: null,
    past: [],
    future: [],
    suppressHistory: false,
    suppressFabricRebuild: false,
    canvasRevision: 0,
    rsvpFormEditorId: null,

    getActivePage: () => activePageFromDoc(get().document, get().activePageId),

    setDocument: (doc, opts) => {
      const normalized = normalizeDocumentMeta(doc)
      const push = opts?.pushHistory !== false && !get().suppressHistory
      set((s) => ({
        document: normalized,
        activePageId: normalized.pages.some((p) => p.id === s.activePageId)
          ? s.activePageId
          : normalized.pages[0]?.id ?? s.activePageId,
        isDirty: true,
        ...(push ? pushPast(s) : {}),
      }))
    },

    updateDocumentMeta: (patch) => {
      set((s) => {
        const doc = cloneDoc(s.document)
        doc.meta = {
          ...doc.meta,
          ...patch,
          name: patch.title ?? patch.name ?? doc.meta.name,
          title: patch.title ?? doc.meta.title ?? doc.meta.name,
          updatedAt: new Date().toISOString(),
        }
        if (patch.title) doc.meta.name = patch.title
        return { document: doc, isDirty: true, ...pushPast(s) }
      })
    },

    openBlankCanvas: () => {
      const doc = createBlankDocument()
      clearDraft()
      set({
        document: doc,
        savedTemplateId: null,
        savedSlug: null,
        isPublished: false,
        activePageId: doc.pages[0]!.id,
        selectedIds: [],
        isDirty: false,
        past: [],
        future: [],
        suppressFabricRebuild: false,
        canvasRevision: get().canvasRevision + 1,
      })
    },

    loadFromRecord: (record) => {
      const doc = normalizeDocumentMeta(cloneDoc(record.document))
      doc.meta.title = record.title
      doc.meta.name = record.title
      persistDraft(doc)
      set({
        document: doc,
        savedTemplateId: record.id,
        savedSlug: record.slug,
        isPublished: record.is_published,
        activePageId: doc.pages[0]?.id ?? get().activePageId,
        selectedIds: [],
        isDirty: false,
        past: [],
        future: [],
        suppressFabricRebuild: false,
        canvasRevision: get().canvasRevision + 1,
      })
    },

    clearSavedRecord: () =>
      set({ savedTemplateId: null, savedSlug: null, isPublished: false }),

    setSavedRecord: (record) => {
      persistDraft(get().document)
      set({
        savedTemplateId: record.id,
        savedSlug: record.slug,
        isPublished: record.is_published,
        isDirty: false,
        lastSavedAt: new Date().toISOString(),
      })
    },

    loadSampleTemplate: () => {
      const doc = cloneDoc(SAMPLE_WEDDING_TEMPLATE)
      doc.meta.updatedAt = new Date().toISOString()
      set((s) => ({
        document: doc,
        activePageId: doc.pages[0].id,
        selectedIds: [],
        isDirty: true,
        suppressFabricRebuild: false,
        canvasRevision: s.canvasRevision + 1,
        ...pushPast(s),
      }))
    },

    setActivePageId: (id) => set({ activePageId: id, selectedIds: [] }),

    addPage: (name, sectionType = 'custom') => {
      const page: TemplatePage = {
        id: newPageId(),
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        sectionType,
        width: DEFAULT_PAGE_SIZE.width,
        height: DEFAULT_PAGE_SIZE.height,
        background: { type: 'solid', color: '#ffffff' },
        elements: [],
      }
      set((s) => {
        const doc = cloneDoc(s.document)
        doc.pages.push(page)
        doc.meta.updatedAt = new Date().toISOString()
        return {
          document: doc,
          activePageId: page.id,
          selectedIds: [],
          isDirty: true,
          ...pushPast(s),
        }
      })
    },

    updatePageBackground: (background) => {
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        page.background = background
        doc.meta.updatedAt = new Date().toISOString()
        return { document: doc, isDirty: true, ...pushPast(s) }
      })
    },

    updatePageMeta: (patch) => {
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        Object.assign(page, patch)
        doc.meta.updatedAt = new Date().toISOString()
        return { document: doc, isDirty: true, ...pushPast(s) }
      })
    },

    selectElements: (ids) => set({ selectedIds: ids }),

    clearSelection: () => set({ selectedIds: [] }),

    addElement: (element) => {
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        const placed: CanvasElement = {
          ...element,
          transform: {
            ...element.transform,
            zIndex: frontZIndexForNewElement(page.elements),
          },
        }
        page.elements.push(placed)
        doc.meta.updatedAt = new Date().toISOString()
        return {
          document: doc,
          selectedIds: [placed.id],
          isDirty: true,
          ...pushPast(s),
        }
      })
    },

    updateElement: (id, patch, opts) => {
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        const idx = page.elements.findIndex((el) => el.id === id)
        if (idx < 0) return s
        page.elements[idx] = { ...page.elements[idx], ...patch } as CanvasElement
        doc.meta.updatedAt = new Date().toISOString()
        return {
          document: doc,
          isDirty: true,
          suppressFabricRebuild: opts?.preserveCanvas ? true : s.suppressFabricRebuild,
          ...(s.suppressHistory ? {} : pushPast(s)),
        }
      })
    },

    updateElementTransform: (id, transform) => {
      const el = get().getActivePage().elements.find((e) => e.id === id)
      if (!el) return
      get().updateElement(id, {
        transform: { ...el.transform, ...transform },
      } as Partial<CanvasElement>)
    },

    batchUpdateElementTransforms: (updates, opts) => {
      if (!updates.length) return
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        let touched = false
        for (const update of updates) {
          const idx = page.elements.findIndex((el) => el.id === update.id)
          if (idx < 0) continue
          page.elements[idx] = {
            ...page.elements[idx],
            transform: { ...page.elements[idx].transform, ...update.transform },
          } as CanvasElement
          touched = true
        }
        if (!touched) return s
        doc.meta.updatedAt = new Date().toISOString()
        return {
          document: doc,
          isDirty: true,
          suppressFabricRebuild: opts?.preserveCanvas ?? true,
          ...(s.suppressHistory ? {} : pushPast(s)),
        }
      })
    },

    deleteSelected: () => {
      const ids = new Set(get().selectedIds)
      if (!ids.size) return
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        page.elements = page.elements.filter((el) => !ids.has(el.id))
        doc.meta.updatedAt = new Date().toISOString()
        return {
          document: doc,
          selectedIds: [],
          isDirty: true,
          ...pushPast(s),
        }
      })
    },

    duplicateSelected: () => {
      const ids = get().selectedIds
      if (!ids.length) return
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        const clones: CanvasElement[] = []
        let nextZ = frontZIndexForNewElement(page.elements)
        for (const id of ids) {
          const src = page.elements.find((el) => el.id === id)
          if (!src) continue
          const copy = structuredClone(src)
          copy.id = newElementId()
          copy.name = `${src.name} copy`
          copy.transform = {
            ...src.transform,
            x: src.transform.x + 16,
            y: src.transform.y + 16,
            zIndex: nextZ++,
          }
          clones.push(copy)
        }
        page.elements.push(...clones)
        doc.meta.updatedAt = new Date().toISOString()
        return {
          document: doc,
          selectedIds: clones.map((c) => c.id),
          isDirty: true,
          ...pushPast(s),
        }
      })
    },

    layerSelected: (direction) => {
      const ids = get().selectedIds
      if (!ids.length) return
      set((s) => {
        const doc = cloneDoc(s.document)
        const page = doc.pages.find((p) => p.id === s.activePageId)
        if (!page) return s
        page.elements = reorderElementsByLayer(page.elements, ids, direction)
        doc.meta.updatedAt = new Date().toISOString()
        return { document: doc, isDirty: true, ...pushPast(s) }
      })
    },

    setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.25, zoom)) }),
    setShowGrid: (v) => set({ showGrid: v }),
    setSnapToGrid: (v) => set({ snapToGrid: v }),
    setPreviewMode: (mode) => set({ previewMode: mode }),
    setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
    setMarketplaceOpen: (open) => set({ marketplaceOpen: open }),

    undo: () => {
      const { past, document, future } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      set({
        past: past.slice(0, -1),
        future: [cloneDoc(document), ...future].slice(0, HISTORY_LIMIT),
        document: cloneDoc(prev),
        selectedIds: [],
        isDirty: true,
      })
    },

    redo: () => {
      const { future, document, past } = get()
      if (!future.length) return
      const next = future[0]
      set({
        future: future.slice(1),
        past: [...past, cloneDoc(document)].slice(-HISTORY_LIMIT),
        document: cloneDoc(next),
        selectedIds: [],
        isDirty: true,
      })
    },

    markSaved: () =>
      set({ isDirty: false, lastSavedAt: new Date().toISOString() }),

    pushHistorySnapshot: () => set((s) => pushPast(s)),

    openRsvpFormEditor: (elementId) => set({ rsvpFormEditorId: elementId }),

    closeRsvpFormEditor: () => set({ rsvpFormEditorId: null }),
  })),
)

/** Debounced local draft persistence */
export function persistDraft(doc: WeddingTemplateDocument) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc))
  } catch {
    /* quota */
  }
}

export function loadDraft(): WeddingTemplateDocument | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as WeddingTemplateDocument
  } catch {
    return null
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    /* ignore */
  }
}

