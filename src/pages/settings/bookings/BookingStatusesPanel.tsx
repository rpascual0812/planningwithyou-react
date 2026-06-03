import { type SubmitEvent, useCallback, useEffect, useState } from 'react'
import StatusEditModal, {
  COLOR_SWATCHES,
  type StatusFormState,
} from '../../../components/StatusEditModal'
import {
  createBookingStatus,
  deleteBookingStatus,
  fetchBookingStatuses,
  reorderBookingStatuses,
  updateBookingStatus,
  type BookingStatusRecord,
} from '../../../services/bookings'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

const BookingStatusesPanel = () => {
  const { canWrite: statusesWrite } = useFeatureAccess('quotation_settings_statuses')
  const [statuses, setStatuses] = useState<BookingStatusRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusModal, setStatusModal] = useState<StatusFormState | null>(null)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<BookingStatusRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reordering, setReordering] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchBookingStatuses()
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
      color: COLOR_SWATCHES[0],
      tags: [],
    })
  }

  const openEdit = (row: BookingStatusRecord) => {
    setStatusModal({
      mode: 'edit',
      id: row.id,
      title: row.title,
      description: row.description,
      color: row.color || COLOR_SWATCHES[0],
      tags: (row.tags ?? []).map((t) => ({ id: t.id, tag: t.tag })),
    })
  }

  const handleStatusSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!statusModal) return

    const title = statusModal.title.trim()
    if (!title) {
      showErrorToast('Title is required.')
      return
    }
    const description = statusModal.description.trim()
    const color = statusModal.color || COLOR_SWATCHES[0]
    const tag_ids = statusModal.tags.map((t) => t.id)

    setSaving(true)
    try {
      if (statusModal.mode === 'create') {
        await createBookingStatus({ title, description, color, tag_ids })
        showSuccessToast('Status created.')
      } else if (statusModal.id) {
        await updateBookingStatus(statusModal.id, {
          title,
          description,
          color,
          tag_ids,
        })
        showSuccessToast('Status updated.')
        setHistoryRefresh((k) => k + 1)
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
      await deleteBookingStatus(deleteTarget.id)
      showSuccessToast('Status deleted.')
      setDeleteTarget(null)
      if (statusModal?.id === deleteTarget.id) setStatusModal(null)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      setError(message)
      showErrorToast(message)
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
      await reorderBookingStatuses(order)
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
        {statusesWrite && (
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
        <div className="text-muted small">
          No statuses yet. Click &quot;Add status&quot; to create one.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0 bookings-statuses-table">
            <thead>
              <tr>
                <th className="bookings-statuses-table__order">Order</th>
                <th>Title</th>
                <th>Description</th>
                <th className="bookings-statuses-table__color">Color</th>
                <th className="bookings-statuses-table__count">Quotations</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((row, index) => (
                <tr key={row.id}>
                  <td className="bookings-statuses-table__order">
                    {statusesWrite ? (
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
                  <td className="text-muted small">
                    {row.description?.trim() || '—'}
                  </td>
                  <td className="bookings-statuses-table__color">
                    <span
                      className="bookings-status-color-swatch"
                      style={{ backgroundColor: row.color || '#1f3a5f' }}
                      title={row.color}
                      aria-hidden="true"
                    />
                  </td>
                  <td className="bookings-statuses-table__count">
                    {row.item_count ?? 0}
                  </td>
                  <td className="text-end">
                    {statusesWrite && (
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          title="Edit status"
                          onClick={() => openEdit(row)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Delete status"
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
        <StatusEditModal
          form={statusModal}
          onChange={setStatusModal}
          onClose={() => !saving && setStatusModal(null)}
          onSubmit={(e) => void handleStatusSubmit(e)}
          historyRefreshKey={historyRefresh}
        />
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
                    aria-label="Close"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete <strong>{deleteTarget.title}</strong>?
                    {(deleteTarget.item_count ?? 0) > 0 && (
                      <>
                        {' '}
                        Its {deleteTarget.item_count} booking
                        {deleteTarget.item_count === 1 ? '' : 's'} will also be
                        removed.
                      </>
                    )}
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

export default BookingStatusesPanel
