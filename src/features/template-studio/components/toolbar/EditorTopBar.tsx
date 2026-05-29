import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import InvitationsLabel from '../InvitationsLabel'
import LayerControls from '../sidebar/LayerControls'
import { useTemplateStudioStore } from '../../store/templateStudioStore'
import { downloadTemplateJson, importTemplateJson } from '../../lib/templateSerializer'
import {
  publishTemplateStudio,
  saveTemplateStudio,
  unpublishTemplateStudio,
} from '../../../../services/templateStudioApi'
import { notifyInvitationSaveError } from '../../lib/invitationSaveErrors'
import { showErrorToast } from '../../../../utils/toast'

type EditorTopBarProps = {
  onOpenTemplates: () => void
  onTemplateSaved?: (id: number, title: string) => void
}

const EditorTopBar = ({ onOpenTemplates, onTemplateSaved }: EditorTopBarProps) => {
  const undo = useTemplateStudioStore((s) => s.undo)
  const redo = useTemplateStudioStore((s) => s.redo)
  const past = useTemplateStudioStore((s) => s.past)
  const future = useTemplateStudioStore((s) => s.future)
  const zoom = useTemplateStudioStore((s) => s.zoom)
  const setZoom = useTemplateStudioStore((s) => s.setZoom)
  const previewMode = useTemplateStudioStore((s) => s.previewMode)
  const setPreviewMode = useTemplateStudioStore((s) => s.setPreviewMode)
  const document = useTemplateStudioStore((s) => s.document)
  const setDocument = useTemplateStudioStore((s) => s.setDocument)
  const updateDocumentMeta = useTemplateStudioStore((s) => s.updateDocumentMeta)
  const isDirty = useTemplateStudioStore((s) => s.isDirty)
  const savedTemplateId = useTemplateStudioStore((s) => s.savedTemplateId)
  const savedSlug = useTemplateStudioStore((s) => s.savedSlug)
  const isPublished = useTemplateStudioStore((s) => s.isPublished)
  const setSavedRecord = useTemplateStudioStore((s) => s.setSavedRecord)
  const setMarketplaceOpen = useTemplateStudioStore((s) => s.setMarketplaceOpen)
  const selectedIds = useTemplateStudioStore((s) => s.selectedIds)

  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const title = document.meta.title || document.meta.name

  const handleSave = async () => {
    if (!title.trim()) {
      setTitleError(true)
      showErrorToast('Template title is required')
      return
    }
    setSaving(true)
    setTitleError(false)
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
      onTemplateSaved?.(record.id, record.title)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setTitleError(notifyInvitationSaveError(message))
    } finally {
      setSaving(false)
    }
  }

  const buildSavePayload = () => ({
    title: title.trim(),
    description: document.meta.description,
    category: document.meta.category,
    document,
  })

  const handlePublish = async () => {
    if (!title.trim()) {
      setTitleError(true)
      showErrorToast('Template title is required')
      return
    }
    setSaving(true)
    setTitleError(false)
    try {
      const payload = buildSavePayload()
      const saved = await saveTemplateStudio(payload, savedTemplateId ?? undefined)
      setSavedRecord({
        id: saved.id,
        slug: saved.slug,
        is_published: saved.is_published,
      })
      onTemplateSaved?.(saved.id, saved.title)
      const record = await publishTemplateStudio(saved.id, payload)
      setSavedRecord({ id: record.id, slug: record.slug, is_published: true })
      onTemplateSaved?.(record.id, record.title)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Publish failed'
      setTitleError(notifyInvitationSaveError(message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <header className="ts-topbar">
      <div className="ts-topbar-left">
        
        <button type="button" className="ts-icon-btn" onClick={undo} disabled={!past.length} title="Undo">
          <i className="bi bi-arrow-counterclockwise" />
        </button>
        <button type="button" className="ts-icon-btn" onClick={redo} disabled={!future.length} title="Redo">
          <i className="bi bi-arrow-clockwise" />
        </button>
        {selectedIds.length > 0 && (
          <>
            <span className="ts-topbar-divider" aria-hidden="true" />
            <LayerControls compact />
          </>
        )}
      </div>

      <div className="ts-topbar-left">
        <input
          className={`ts-doc-title${titleError ? ' ts-doc-title--error' : ''}`}
          value={title}
          onChange={(e) => {
            setTitleError(false)
            updateDocumentMeta({ title: e.target.value, name: e.target.value })
          }}
          placeholder="Untitled design"
          aria-label="Design title"
          aria-invalid={titleError || undefined}
          style={{width: '580px', maxWidth: '100%', flexShrink: 0}}
        />
        {isDirty && <span className="ts-save-dot" title="Unsaved changes" />}
      </div>

      <div className="ts-topbar-right">
        <div className="ts-zoom-pill" style={{display: 'none'}}>
          <button type="button" className="ts-icon-btn ts-icon-btn--sm" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom out">
            <i className="bi bi-dash" />
          </button>
          <span className="ts-zoom-value">{Math.round(zoom * 100)}%</span>
          <button type="button" className="ts-icon-btn ts-icon-btn--sm" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom in">
            <i className="bi bi-plus" />
          </button>
        </div>

        <div className="ts-segment" role="group" aria-label="Preview device" style={{display: 'none'}}>
          <button
            type="button"
            className={`ts-segment-btn${previewMode === 'desktop' ? ' is-active' : ''}`}
            onClick={() => setPreviewMode('desktop')}
          >
            <i className="bi bi-display" />
          </button>
          <button
            type="button"
            className={`ts-segment-btn${previewMode === 'mobile' ? ' is-active' : ''}`}
            onClick={() => setPreviewMode('mobile')}
          >
            <i className="bi bi-phone" />
          </button>
        </div>

        

        <button type="button" className="ts-btn ts-btn--ghost" onClick={onOpenTemplates}>
          Open templates
        </button>

        <div className="ts-menu-wrap" ref={menuRef} style={{display: 'none'}}>
          <button type="button" className="ts-btn ts-btn--ghost" onClick={() => setMenuOpen((v) => !v)}>
            <i className="bi bi-three-dots" />
          </button>
          {menuOpen && (
            <div className="ts-dropdown">
              <button type="button" onClick={() => { setMarketplaceOpen(true); setMenuOpen(false) }}>
                Marketplace
              </button>
              <button type="button" onClick={() => { downloadTemplateJson(document); setMenuOpen(false) }}>
                Export JSON
              </button>
              <button type="button" onClick={() => { fileRef.current?.click(); setMenuOpen(false) }}>
                Import JSON
              </button>
            </div>
          )}
        </div>

        <button type="button" className="ts-btn ts-btn--secondary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="ts-btn ts-btn--primary" disabled={saving} onClick={() => void handlePublish()}>
          {saving ? 'Publishing…' : isPublished ? 'Update live' : 'Publish'}
        </button>

        {isPublished && savedSlug && (
          <>
            <a className="ts-btn ts-btn--ghost" href={`/invitations/${savedSlug}`} target="_blank" rel="noreferrer">
              Preview
            </a>
            <a
              className="ts-btn ts-btn--ghost"
              href={`/invitations/${savedSlug}/rsvp`}
              target="_blank"
              rel="noreferrer"
            >
              RSVPs
            </a>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="d-none"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            try {
              setDocument(importTemplateJson(String(reader.result)))
            } catch {
              window.alert('Invalid template JSON')
            }
          }
          reader.readAsText(file)
          e.target.value = ''
          setMenuOpen(false)
        }}
      />
    </header>
  )
}

export default EditorTopBar
