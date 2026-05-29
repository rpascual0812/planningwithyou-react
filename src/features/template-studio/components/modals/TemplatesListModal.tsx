import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteTemplateStudio,
  duplicateTemplateStudio,
  fetchTemplateStudioList,
  type TemplateStudioRecord,
} from '../../../../services/templateStudioApi'
import { buildTemplateStudioPath } from '../../lib/templateStudioUrl'
import { useTemplateStudioStore } from '../../store/templateStudioStore'

type TemplatesListModalProps = {
  open: boolean
  onClose: () => void
}

const TemplatesListModal = ({ open, onClose }: TemplatesListModalProps) => {
  const navigate = useNavigate()
  const savedTemplateId = useTemplateStudioStore((s) => s.savedTemplateId)

  const [items, setItems] = useState<TemplateStudioRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchTemplateStudioList())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const handleOpen = (item: TemplateStudioRecord) => {
    navigate(buildTemplateStudioPath(item.id, item.title))
    onClose()
  }

  const handleDuplicate = async (id: number) => {
    try {
      await duplicateTemplateStudio(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate failed')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this template?')) return
    try {
      await deleteTemplateStudio(id)
      if (savedTemplateId === id) {
        useTemplateStudioStore.getState().clearSavedRecord()
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (!open) return null

  return (
    <>
      <div className="modal fade show d-block ts-modal" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">My templates</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body p-0">
              {error && <div className="alert alert-danger m-3 py-2">{error}</div>}
              {loading && <div className="p-3 text-muted">Loading…</div>}
              {!loading && items.length === 0 && (
                <div className="p-3 text-muted small">No saved templates yet. Create one and click Save.</div>
              )}
              {items.length > 0 && (
                <ul className="ts-template-list">
                  {items.map((item) => (
                    <li key={item.id} className="ts-template-list-item">
                      <button
                        type="button"
                        className="ts-template-list-open"
                        onClick={() => handleOpen(item)}
                      >
                        <strong>{item.title}</strong>
                        <span className="ts-template-list-meta">
                          Updated {new Date(item.updated_at).toLocaleString()}
                          {item.is_published && (
                            <span className="ts-template-published">Published</span>
                          )}
                        </span>
                      </button>
                      <div className="ts-template-list-actions">
                        <button
                          type="button"
                          className="ts-icon-btn ts-icon-btn--sm"
                          title="Duplicate"
                          onClick={() => void handleDuplicate(item.id)}
                        >
                          <i className="bi bi-copy" />
                        </button>
                        <button
                          type="button"
                          className="ts-icon-btn ts-icon-btn--sm ts-icon-btn--danger"
                          title="Delete"
                          onClick={() => void handleDelete(item.id)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" onClick={onClose} />
    </>
  )
}

export default TemplatesListModal
