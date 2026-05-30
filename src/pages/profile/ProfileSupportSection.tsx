import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMCEEditor } from 'tinymce'
import SupportTicketChatModal from '../../components/SupportTicketChatModal'
import { hasMeaningfulEmailBody } from '../../lib/emailBody'
import { TINYMCE_EDITOR_SHARED_PROPS } from '../../lib/tinymceFreeEditor'
import { SYSTEM_NOTIFICATION_EDITOR_INIT } from '../../lib/tinymceSystemNotification'
import {
  createSupportTicket,
  deleteSupportTicket,
  fetchSupportTicket,
  fetchSupportTickets,
  sendSupportTicketMessage,
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketRecord,
} from '../../services/supportTickets'

function formatDateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString()
}

const ProfileSupportSection = () => {
  const [rows, setRows] = useState<SupportTicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [messageEditorKey, setMessageEditorKey] = useState(0)
  const messageEditorRef = useRef<TinyMCEEditor | null>(null)

  const [chatTicket, setChatTicket] = useState<SupportTicketRecord | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSupportTickets()
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load support tickets')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const handleTicketUpdated = useCallback(
    (summary: { id: number; status: SupportTicketRecord['status']; is_read: boolean }) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === summary.id
            ? { ...r, status: summary.status, is_read: summary.is_read }
            : r,
        ),
      )
      setChatTicket((prev) =>
        prev && prev.id === summary.id
          ? { ...prev, status: summary.status, is_read: summary.is_read }
          : prev,
      )
    },
    [],
  )

  const closeCreate = () => {
    setCreateOpen(false)
    setTitle('')
    setMessage('')
    setFormError(null)
    messageEditorRef.current = null
    setMessageEditorKey((k) => k + 1)
  }

  const openCreate = () => {
    setTitle('')
    setMessage('')
    setFormError(null)
    messageEditorRef.current = null
    setMessageEditorKey((k) => k + 1)
    setCreateOpen(true)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const messageHtml = messageEditorRef.current?.getContent() ?? message
    if (!trimmedTitle || !hasMeaningfulEmailBody(messageHtml)) {
      setFormError('Title and message are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    setError(null)
    try {
      await createSupportTicket({
        title: trimmedTitle,
        message: messageHtml,
      })
      closeCreate()
      await loadRows()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to file ticket')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: SupportTicketRecord) => {
    if (!row.can_delete) return
    if (!window.confirm(`Delete ticket "${row.title}"?`)) return
    setDeletingId(row.id)
    setError(null)
    try {
      await deleteSupportTicket(row.id)
      if (chatTicket?.id === row.id) setChatTicket(null)
      await loadRows()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete ticket')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <header className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h5 className="settings-card-title mb-0">Support</h5>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openCreate}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          File new
        </button>
      </header>

      {error && (
        <div className="alert alert-danger py-2 mt-3" role="alert">
          {error}
        </div>
      )}

      <div className="support-tickets-panel mt-3">
        {loading ? (
          <p className="text-muted small mb-0">Loading support tickets…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted small mb-0">
            No support tickets yet. Use <strong>File new</strong> to contact support.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0 support-tickets-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Last activity</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`support-tickets-row${row.is_read ? '' : ' support-tickets-row--unread'}`}
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 text-start support-tickets-title-btn"
                        onClick={() => setChatTicket(row)}
                      >
                        {row.title}
                      </button>
                      {row.last_message_preview ? (
                        <div className="text-muted small text-truncate support-tickets-preview">
                          {row.last_message_preview}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {SUPPORT_TICKET_STATUS_LABELS[row.status] ?? row.status}
                    </td>
                    <td className="text-muted small">
                      {formatDateTime(row.last_message_at || row.created_at)}
                    </td>
                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary me-1"
                        onClick={() => setChatTicket(row)}
                      >
                        View
                      </button>
                      {row.can_delete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          disabled={deletingId === row.id}
                          onClick={() => void handleDelete(row)}
                        >
                          {deletingId === row.id ? 'Deleting…' : 'Delete'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <>
          <div
            className="modal-backdrop fade show"
            aria-hidden="true"
            onClick={closeCreate}
          />
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
              <form className="modal-content" onSubmit={handleCreate}>
                <div className="modal-header">
                  <h5 className="modal-title">File new support ticket</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeCreate}
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
                    <label className="form-label" htmlFor="support-ticket-title">
                      Title
                    </label>
                    <input
                      id="support-ticket-title"
                      type="text"
                      className="form-control"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={255}
                      required
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label" htmlFor="support-ticket-message">
                      Message
                    </label>
                    <div id="support-ticket-message" className="support-ticket-message-editor">
                      <Editor
                        {...TINYMCE_EDITOR_SHARED_PROPS}
                        key={messageEditorKey}
                        value={message}
                        onInit={(_evt, editor) => {
                          messageEditorRef.current = editor
                        }}
                        onEditorChange={(content) => setMessage(content)}
                        init={SYSTEM_NOTIFICATION_EDITOR_INIT}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeCreate}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Submitting…' : 'Submit ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {chatTicket && (
        <SupportTicketChatModal
          ticketId={chatTicket.id}
          title={chatTicket.title}
          status={chatTicket.status}
          canDelete={chatTicket.can_delete}
          canReply
          loadTicket={fetchSupportTicket}
          sendMessage={sendSupportTicketMessage}
          onClose={() => {
            setChatTicket(null)
            void loadRows()
          }}
          onDelete={() => handleDelete(chatTicket)}
          onTicketUpdated={handleTicketUpdated}
          deleting={deletingId === chatTicket.id}
        />
      )}
    </>
  )
}

export default ProfileSupportSection
