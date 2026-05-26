import { type SubmitEvent, useCallback, useEffect, useState } from 'react'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import {
  createCalendarStatus,
  deleteCalendarStatus,
  fetchCalendarStatuses,
  reorderCalendarStatuses,
  updateCalendarStatus,
  type CalendarStatusRecord,
} from '../../../services/calendar'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

const DEFAULT_TEXT = '#ffffff'
const DEFAULT_BG = '#5a8edb'

type StatusFormState = {
  mode: 'create' | 'edit'
  id: number | null
  title: string
  description: string
  text_color: string
  background_color: string
}

const CalendarStatusesPanel = () => {
  const { canWrite: calendarWrite } = useFeatureAccess('calendar')
  const [statuses, setStatuses] = useState<CalendarStatusRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusModal, setStatusModal] = useState<StatusFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CalendarStatusRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reordering, setReordering] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchCalendarStatuses()
      setStatuses(
        [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load statuses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openAdd = () => {
    setStatusModal({
      mode: 'create',
      id: null,
      title: '',
      description: '',
      text_color: DEFAULT_TEXT,
      background_color: DEFAULT_BG,
    })
  }

  const openEdit = (row: CalendarStatusRecord) => {
    setStatusModal({
      mode: 'edit',
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      text_color: row.text_color || DEFAULT_TEXT,
      background_color: row.background_color || DEFAULT_BG,
    })
  }

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!statusModal) return
    const title = statusModal.title.trim()
    if (!title) {
      showErrorToast('Title is required.')
      return
    }
    const payload = {
      title,
      description: statusModal.description.trim(),
      text_color: statusModal.text_color,
      background_color: statusModal.background_color,
    }
    setSaving(true)
    try {
      if (statusModal.mode === 'create') {
        await createCalendarStatus(payload)
        showSuccessToast('Status created.')
      } else if (statusModal.id) {
        await updateCalendarStatus(statusModal.id, payload)
        showSuccessToast('Status updated.')
      }
      setStatusModal(null)
      await load()
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCalendarStatus(deleteTarget.id)
      showSuccessToast('Status deleted.')
      setDeleteTarget(null)
      if (statusModal?.id === deleteTarget.id) setStatusModal(null)
      await load()
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Delete failed')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const moveStatus = async (id: number, direction: 'up' | 'down') => {
    const index = statuses.findIndex((s) => s.id === id)
    if (index < 0) return
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (swapWith < 0 || swapWith >= statuses.length) return
    const next = [...statuses]
    ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
    const order = next.map((s) => s.id)
    setReordering(true)
    try {
      await reorderCalendarStatuses(order)
      setStatuses(next.map((s, idx) => ({ ...s, sort_order: idx })))
      showSuccessToast('Order updated.')
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Could not reorder statuses')
      await load()
    } finally {
      setReordering(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {statuses.length} status{statuses.length !== 1 && 'es'}
        </span>
        {calendarWrite && (
          <button type="button" className="btn btn-sm btn-primary" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Add status
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading && statuses.length === 0 ? (
        <div className="text-muted">Loading…</div>
      ) : statuses.length === 0 ? (
        <div className="text-muted small">No calendar statuses yet.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Order</th>
                <th>Title</th>
                <th>Colors</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    {calendarWrite ? (
                      <div className="d-inline-flex flex-column gap-0">
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 text-secondary"
                          title="Move up"
                          disabled={index === 0 || reordering}
                          onClick={() => void moveStatus(row.id, 'up')}
                        >
                          <i className="bi bi-chevron-up" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 text-secondary"
                          title="Move down"
                          disabled={index === statuses.length - 1 || reordering}
                          onClick={() => void moveStatus(row.id, 'down')}
                        >
                          <i className="bi bi-chevron-down" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-muted small">{index + 1}</span>
                    )}
                  </td>
                  <td className="fw-semibold">{row.title}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        color: row.text_color,
                        backgroundColor: row.background_color,
                      }}
                    >
                      Preview
                    </span>
                  </td>
                  <td className="text-end">
                    {calendarWrite && (
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEdit(row)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {statusModal && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => !saving && setStatusModal(null)}
          />
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={(e) => void handleSubmit(e)}>
                  <div className="modal-header">
                    <h2 className="modal-title fs-5">
                      {statusModal.mode === 'create' ? 'Add status' : 'Edit status'}
                    </h2>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={() => setStatusModal(null)}
                      disabled={saving}
                    />
                  </div>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Title</label>
                      <input
                        className="form-control"
                        value={statusModal.title}
                        onChange={(e) =>
                          setStatusModal({ ...statusModal, title: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={statusModal.description}
                        onChange={(e) =>
                          setStatusModal({ ...statusModal, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label">Text color</label>
                        <input
                          type="color"
                          className="form-control form-control-color w-100"
                          value={statusModal.text_color}
                          onChange={(e) =>
                            setStatusModal({ ...statusModal, text_color: e.target.value })
                          }
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label">Background</label>
                        <input
                          type="color"
                          className="form-control form-control-color w-100"
                          value={statusModal.background_color}
                          onChange={(e) =>
                            setStatusModal({
                              ...statusModal,
                              background_color: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setStatusModal(null)}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">Delete status</h2>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete <strong>{deleteTarget.title}</strong>?
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void confirmDelete()}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CalendarStatusesPanel
