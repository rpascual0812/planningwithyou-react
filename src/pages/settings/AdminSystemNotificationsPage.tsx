import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMCEEditor } from 'tinymce'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { hasMeaningfulEmailBody, htmlToPlainText } from '../../lib/emailBody'
import { TINYMCE_EDITOR_SHARED_PROPS } from '../../lib/tinymceFreeEditor'
import { SYSTEM_NOTIFICATION_EDITOR_INIT } from '../../lib/tinymceSystemNotification'
import {
  createSystemNotification,
  deleteSystemNotification,
  fetchAdminSystemNotifications,
  updateSystemNotification,
  type SystemNotificationPayload,
  type SystemNotificationRecord,
} from '../../services/systemNotifications'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active now' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
]

const EMPTY_FORM: SystemNotificationPayload = {
  title: '',
  message: '',
  start_date: '',
  end_date: '',
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toDatetimeLocalValue(iso: string): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) return ''
  return new Date(value).toISOString()
}

function statusLabel(row: SystemNotificationRecord): string {
  const now = Date.now()
  const start = new Date(row.start_date).getTime()
  const end = new Date(row.end_date).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 'Active'
  if (end < now) return 'Expired'
  if (start > now) return 'Scheduled'
  return 'Active'
}

function statusClass(row: SystemNotificationRecord): string {
  const label = statusLabel(row)
  if (label === 'Active') return 'sys-notif-status--active'
  if (label === 'Scheduled') return 'sys-notif-status--scheduled'
  return 'sys-notif-status--expired'
}

const AdminSystemNotificationsPage = () => {
  const [rows, setRows] = useState<SystemNotificationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SystemNotificationRecord | null>(null)
  const [form, setForm] = useState<SystemNotificationPayload>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<SystemNotificationRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [messageEditorKey, setMessageEditorKey] = useState(0)
  const messageEditorRef = useRef<TinyMCEEditor | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadRows = useCallback(async (q = '', status = '') => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminSystemNotifications(q, status)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRows(debouncedSearch, statusFilter)
  }, [debouncedSearch, statusFilter, loadRows])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setMessageEditorKey((k) => k + 1)
    setModalOpen(true)
  }

  const openEdit = (row: SystemNotificationRecord) => {
    setEditing(row)
    setForm({
      title: row.title,
      message: row.message,
      start_date: toDatetimeLocalValue(row.start_date),
      end_date: toDatetimeLocalValue(row.end_date),
    })
    setFormError(null)
    setMessageEditorKey((k) => k + 1)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    messageEditorRef.current = null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim()
    const message = messageEditorRef.current?.getContent() ?? form.message
    if (!title || !hasMeaningfulEmailBody(message) || !form.start_date || !form.end_date) {
      setFormError('Title, message, start time, and end time are required.')
      return
    }
    if (form.end_date < form.start_date) {
      setFormError('End time must be on or after the start time.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload: SystemNotificationPayload = {
        title,
        message,
        start_date: fromDatetimeLocalValue(form.start_date),
        end_date: fromDatetimeLocalValue(form.end_date),
      }
      if (editing) {
        await updateSystemNotification(editing.id, payload)
      } else {
        await createSystemNotification(payload)
      }
      closeModal()
      await loadRows(debouncedSearch, statusFilter)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save notification')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSystemNotification(deleteTarget.id)
      setDeleteTarget(null)
      await loadRows(debouncedSearch, statusFilter)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete notification')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="sys-notif-admin">
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <div className="d-flex flex-wrap gap-2 flex-grow-1">
          <input
            type="search"
            className="form-control"
            placeholder="Search title or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '280px' }}
          />
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: '180px' }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" />
          Add notification
        </button>
      </div>

      {error && (
        <p className="text-danger small" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted small mb-0">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted small mb-0">No system notifications yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Title</th>
                <th>Message</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Created by</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="fw-semibold">{row.title}</td>
                  <td className="sys-notif-admin-message" title={htmlToPlainText(row.message)}>
                    {htmlToPlainText(row.message) || '—'}
                  </td>
                  <td>{formatDateTime(row.start_date)}</td>
                  <td>{formatDateTime(row.end_date)}</td>
                  <td>
                    <span className={`sys-notif-status ${statusClass(row)}`}>
                      {statusLabel(row)}
                    </span>
                  </td>
                  <td>{row.created_by_name || '—'}</td>
                  <td className="text-end text-nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary me-1"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setDeleteTarget(row)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <>
          <div
            className="user-details-modal-backdrop modal-backdrop fade show"
            aria-hidden="true"
            onClick={closeModal}
          />
          <div
            className="user-details-modal modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <form className="modal-content" onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">
                  {editing ? 'Edit notification' : 'Add notification'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeModal}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                {formError && (
                  <p className="text-danger small" role="alert">
                    {formError}
                  </p>
                )}
                <div className="mb-3">
                  <label className="form-label" htmlFor="sys-notif-title">
                    Title
                  </label>
                  <input
                    id="sys-notif-title"
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    maxLength={255}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="sys-notif-message">
                    Message
                  </label>
                  <div id="sys-notif-message" className="sys-notif-message-editor">
                    <Editor
                      {...TINYMCE_EDITOR_SHARED_PROPS}
                      key={messageEditorKey}
                      value={form.message}
                      onInit={(_evt, editor) => {
                        messageEditorRef.current = editor
                      }}
                      onEditorChange={(content) => {
                        setForm((f) => ({ ...f, message: content }))
                      }}
                      init={SYSTEM_NOTIFICATION_EDITOR_INIT}
                    />
                  </div>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="sys-notif-start">
                      Start
                    </label>
                    <input
                      id="sys-notif-start"
                      type="datetime-local"
                      className="form-control"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, start_date: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="sys-notif-end">
                      End
                    </label>
                    <input
                      id="sys-notif-end"
                      type="datetime-local"
                      className="form-control"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, end_date: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create'}
                </button>
              </div>
              </form>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <>
          <div
            className="user-details-modal-backdrop modal-backdrop fade show"
            aria-hidden="true"
            onClick={() => setDeleteTarget(null)}
          />
          <div
            className="user-details-modal modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete notification</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleteTarget(null)}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  Delete <strong>{deleteTarget.title}</strong>? It will be removed from the
                  header for all users.
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

export default AdminSystemNotificationsPage
