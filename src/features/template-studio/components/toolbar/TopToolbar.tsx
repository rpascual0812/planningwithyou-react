import { useRef, useState } from 'react'
import { useTemplateStudioStore } from '../../store/templateStudioStore'
import { downloadTemplateJson, importTemplateJson } from '../../lib/templateSerializer'
import {
  publishTemplateStudio,
  saveTemplateStudio,
  unpublishTemplateStudio,
} from '../../../../services/templateStudioApi'

const TopToolbar = () => {
  const undo = useTemplateStudioStore((s) => s.undo)
  const redo = useTemplateStudioStore((s) => s.redo)
  const past = useTemplateStudioStore((s) => s.past)
  const future = useTemplateStudioStore((s) => s.future)
  const zoom = useTemplateStudioStore((s) => s.zoom)
  const setZoom = useTemplateStudioStore((s) => s.setZoom)
  const showGrid = useTemplateStudioStore((s) => s.showGrid)
  const setShowGrid = useTemplateStudioStore((s) => s.setShowGrid)
  const snapToGrid = useTemplateStudioStore((s) => s.snapToGrid)
  const setSnapToGrid = useTemplateStudioStore((s) => s.setSnapToGrid)
  const previewMode = useTemplateStudioStore((s) => s.previewMode)
  const setPreviewMode = useTemplateStudioStore((s) => s.setPreviewMode)
  const document = useTemplateStudioStore((s) => s.document)
  const setDocument = useTemplateStudioStore((s) => s.setDocument)
  const loadSampleTemplate = useTemplateStudioStore((s) => s.loadSampleTemplate)
  const isDirty = useTemplateStudioStore((s) => s.isDirty)
  const lastSavedAt = useTemplateStudioStore((s) => s.lastSavedAt)
  const savedTemplateId = useTemplateStudioStore((s) => s.savedTemplateId)
  const savedSlug = useTemplateStudioStore((s) => s.savedSlug)
  const isPublished = useTemplateStudioStore((s) => s.isPublished)
  const setSavedRecord = useTemplateStudioStore((s) => s.setSavedRecord)
  const setMarketplaceOpen = useTemplateStudioStore((s) => s.setMarketplaceOpen)
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const title = document.meta.title || document.meta.name

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const doc = importTemplateJson(String(reader.result))
        setDocument(doc)
      } catch {
        window.alert('Invalid template JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setSaveError('Template title is required')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const record = await saveTemplateStudio(
        {
          title: title.trim(),
          description: document.meta.description,
          category: document.meta.category,
          document,
        },
        savedTemplateId ?? undefined,
      )
      setSavedRecord({
        id: record.id,
        slug: record.slug,
        is_published: record.is_published,
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      setSaveError('Template title is required')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        title: title.trim(),
        description: document.meta.description,
        category: document.meta.category,
        document,
      }
      const saved = await saveTemplateStudio(payload, savedTemplateId ?? undefined)
      setSavedRecord({
        id: saved.id,
        slug: saved.slug,
        is_published: saved.is_published,
      })
      const record = await publishTemplateStudio(saved.id, payload)
      setSavedRecord({
        id: record.id,
        slug: record.slug,
        is_published: true,
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setSaving(false)
    }
  }

  const handleUnpublish = async () => {
    if (!savedTemplateId) return
    setSaving(true)
    try {
      const record = await unpublishTemplateStudio(savedTemplateId)
      setSavedRecord({
        id: record.id,
        slug: record.slug,
        is_published: record.is_published,
      })
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unpublish failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <header className="ts-toolbar border-bottom bg-white px-3 py-2 d-flex align-items-center gap-2 flex-wrap">
      <div className="d-flex align-items-center gap-1">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">
          <i className="bi bi-arrow-counterclockwise" />
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Y)">
          <i className="bi bi-arrow-clockwise" />
        </button>
      </div>

      <div className="vr d-none d-md-block" />

      <div className="d-flex align-items-center gap-1">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom out">
          <i className="bi bi-dash-lg" />
        </button>
        <span className="small text-muted px-1" style={{ minWidth: 48, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom in">
          <i className="bi bi-plus-lg" />
        </button>
      </div>

      <div className="vr d-none d-md-block" />

      <div className="form-check form-check-inline mb-0 small">
        <input id="ts-grid" className="form-check-input" type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
        <label className="form-check-label" htmlFor="ts-grid">Grid</label>
      </div>
      <div className="form-check form-check-inline mb-0 small">
        <input id="ts-snap" className="form-check-input" type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
        <label className="form-check-label" htmlFor="ts-snap">Snap</label>
      </div>

      <div className="btn-group btn-group-sm ms-md-2" role="group" aria-label="Preview mode">
        <button type="button" className={`btn btn-outline-secondary${previewMode === 'desktop' ? ' active' : ''}`} onClick={() => setPreviewMode('desktop')}>
          Desktop
        </button>
        <button type="button" className={`btn btn-outline-secondary${previewMode === 'mobile' ? ' active' : ''}`} onClick={() => setPreviewMode('mobile')}>
          Mobile
        </button>
      </div>

      <div className="ms-auto d-flex align-items-center gap-2 flex-wrap">
        {saveError && <span className="small text-danger">{saveError}</span>}
        <span className="small text-muted d-none d-lg-inline">
          {isDirty ? 'Unsaved changes' : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Auto-save on'}
        </span>
        {isPublished && savedSlug && (
          <a
            className="btn btn-sm btn-outline-success"
            href={`/invitations/${savedSlug}`}
            target="_blank"
            rel="noreferrer"
          >
            View live
          </a>
        )}
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setMarketplaceOpen(true)}>
          Marketplace
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadSampleTemplate}>
          Sample
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => downloadTemplateJson(document)}>
          Export JSON
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="d-none" onChange={onImport} />
        <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save template'}
        </button>
        {savedTemplateId && (
          <button type="button" className="btn btn-sm btn-success" disabled={saving} onClick={() => void handlePublish()}>
            {saving ? 'Publishing…' : isPublished ? 'Update live' : 'Publish'}
          </button>
        )}
        {savedTemplateId && isPublished && (
          <button type="button" className="btn btn-sm btn-outline-warning" disabled={saving} onClick={() => void handleUnpublish()}>
            Unpublish
          </button>
        )}
      </div>
    </header>
  )
}

export default TopToolbar
