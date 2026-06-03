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
  fetchSupportTicketsPage,
  sendSupportTicketMessage,
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketsPage,
  type SupportTicketRecord,
} from '../../services/supportTickets'
import { formatAppDateTime } from '../../lib/formatDateTime'

const ProfileSupportSection = () => {
  const [rows, setRows] = useState<SupportTicketRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
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
  const loadingMoreRef = useRef(false)
  const scrollRootRef = useRef<HTMLDivElement | null>(null)

  const loadPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (replace) {
      setLoading(true)
      setError(null)
    } else {
      if (loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    try {
      const data: SupportTicketsPage = await fetchSupportTicketsPage(pageNum)
      setRows((prev) => (replace ? data.results : [...prev, ...data.results]))
      setTotalCount(data.count)
      setPage(pageNum)
      setHasMore(data.next != null)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to load support tickets'
      if (replace) {
        setError(message)
        setRows([])
        setTotalCount(0)
        setPage(0)
        setHasMore(false)
      }
    } finally {
      if (replace) {
        setLoading(false)
      } else {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  const loadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    void loadPage(page + 1, false)
  }, [hasMore, loading, loadingMore, page, loadPage])

  const maybeLoadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    const root = scrollRootRef.current
    const containerHasVerticalScroll =
      !!root && root.scrollHeight > root.clientHeight + 1
    const nearContainerBottom =
      !!root &&
      root.scrollTop + root.clientHeight >= root.scrollHeight - 12
    const pageRoot = document.documentElement
    const nearPageBottom =
      window.innerHeight + window.scrollY >= pageRoot.scrollHeight - 12
    if (
      (containerHasVerticalScroll && nearContainerBottom) ||
      (!containerHasVerticalScroll && nearPageBottom)
    ) {
      loadNextPage()
    }
  }, [hasMore, loading, loadingMore, loadNextPage])

  const handleRowsScroll = useCallback(() => {
    maybeLoadNextPage()
  }, [maybeLoadNextPage])

  useEffect(() => {
    window.addEventListener('scroll', maybeLoadNextPage, { passive: true })
    return () => window.removeEventListener('scroll', maybeLoadNextPage)
  }, [maybeLoadNextPage])

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
      await loadPage(1, true)
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
      await loadPage(1, true)
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
        {loading && rows.length === 0 ? (
          <p className="text-muted small mb-0">Loading support tickets…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted small mb-0">
            No support tickets yet. Use <strong>File new</strong> to contact support.
          </p>
        ) : (
          <div
            ref={scrollRootRef}
            className="table-responsive"
            onScroll={handleRowsScroll}
          >
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
                      {formatAppDateTime(row.last_message_at || row.created_at)}
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
                {hasMore && rows.length > 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted small py-3">
                      {loadingMore ? 'Loading more...' : 'Scroll for more'}
                    </td>
                  </tr>
                )}
                {!hasMore && rows.length > 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted small py-3">
                      All {totalCount} support ticket{totalCount !== 1 ? 's have' : ' has'} been loaded.
                    </td>
                  </tr>
                )}
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
            void loadPage(1, true)
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
