import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMCEEditor } from 'tinymce'
import { useCallback, useEffect, useRef, useState } from 'react'
import { hasMeaningfulEmailBody } from '../lib/emailBody'
import { TINYMCE_EDITOR_SHARED_PROPS } from '../lib/tinymceFreeEditor'
import { SUPPORT_CHAT_EDITOR_INIT } from '../lib/tinymceSupportChat'
import {
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketDetailRecord,
  type SupportTicketMessageRecord,
  type SupportTicketStatus,
} from '../services/supportTickets'

export type SupportTicketChatModalProps = {
  ticketId: number
  title: string
  status: SupportTicketStatus
  createdByName?: string
  canDelete?: boolean
  canReply: boolean
  isAdmin?: boolean
  onClose: () => void
  onDelete?: () => void | Promise<void>
  onTicketUpdated?: (summary: {
    id: number
    status: SupportTicketStatus
    is_read: boolean
  }) => void
  loadTicket: (id: number) => Promise<SupportTicketDetailRecord>
  sendMessage: (ticketId: number, body: string) => Promise<SupportTicketMessageRecord>
  updateStatus?: (
    ticketId: number,
    status: SupportTicketStatus,
  ) => Promise<{ status: SupportTicketStatus }>
  deleting?: boolean
}

function formatMessageTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_OPTIONS: SupportTicketStatus[] = [
  'open',
  'in_progress',
  'resolved',
  'closed',
]

const SupportTicketChatModal = ({
  ticketId,
  title,
  status: initialStatus,
  createdByName,
  canDelete = false,
  canReply,
  isAdmin = false,
  onClose,
  onDelete,
  onTicketUpdated,
  loadTicket,
  sendMessage,
  updateStatus,
  deleting = false,
}: SupportTicketChatModalProps) => {
  const [messages, setMessages] = useState<SupportTicketMessageRecord[]>([])
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const editorRef = useRef<TinyMCEEditor | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  const refreshTicket = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const detail = await loadTicket(ticketId)
      setMessages(detail.messages)
      setStatus(detail.status)
      onTicketUpdated?.({
        id: detail.id,
        status: detail.status,
        is_read: true,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }, [loadTicket, onTicketUpdated, ticketId])

  useEffect(() => {
    void refreshTicket()
  }, [refreshTicket])

  useEffect(() => {
    if (!loading) scrollToBottom()
  }, [loading, messages, scrollToBottom])

  const clearComposer = () => {
    setReplyDraft('')
    editorRef.current = null
    setEditorKey((k) => k + 1)
  }

  const handleSend = async () => {
    const body = editorRef.current?.getContent() ?? replyDraft
    if (!hasMeaningfulEmailBody(body)) {
      setSendError('Enter a message before sending.')
      return
    }
    setSending(true)
    setSendError(null)
    try {
      const created = await sendMessage(ticketId, body)
      setMessages((prev) => [...prev, created])
      clearComposer()
      scrollToBottom()
      onTicketUpdated?.({ id: ticketId, status, is_read: true })
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (next: SupportTicketStatus) => {
    if (!updateStatus || next === status) return
    setUpdatingStatus(true)
    setError(null)
    try {
      const updated = await updateStatus(ticketId, next)
      setStatus(updated.status)
      onTicketUpdated?.({ id: ticketId, status: updated.status, is_read: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <>
      <div
        className="modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="modal fade show d-block support-ticket-chat-modal"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content support-ticket-chat">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-0">{title}</h5>
                {createdByName ? (
                  <p className="text-muted small mb-0">From {createdByName}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body support-ticket-chat-body p-0">
              <div className="support-ticket-chat-meta px-3 py-2 border-bottom">
                {isAdmin && updateStatus ? (
                  <select
                    className="form-select form-select-sm"
                    style={{ maxWidth: '200px' }}
                    value={status}
                    disabled={updatingStatus}
                    onChange={(e) =>
                      void handleStatusChange(e.target.value as SupportTicketStatus)
                    }
                    aria-label="Ticket status"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {SUPPORT_TICKET_STATUS_LABELS[opt]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="badge text-bg-secondary">
                    {SUPPORT_TICKET_STATUS_LABELS[status] ?? status}
                  </span>
                )}
              </div>

              {error && (
                <p className="text-danger small px-3 pt-2 mb-0" role="alert">
                  {error}
                </p>
              )}

              <div
                ref={threadRef}
                className="support-ticket-chat-thread px-3 py-3"
                aria-live="polite"
              >
                {loading ? (
                  <p className="text-muted small mb-0">Loading conversation…</p>
                ) : messages.length === 0 ? (
                  <p className="text-muted small mb-0">No messages yet.</p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.is_mine
                    const bubbleClass = isMine
                      ? 'support-ticket-chat-bubble--mine'
                      : msg.is_staff
                        ? 'support-ticket-chat-bubble--staff'
                        : 'support-ticket-chat-bubble--other'
                    return (
                      <div
                        key={msg.id}
                        className={`support-ticket-chat-row${isMine ? ' support-ticket-chat-row--mine' : ''}`}
                      >
                        <div className={`support-ticket-chat-bubble ${bubbleClass}`}>
                          <div className="support-ticket-chat-bubble-meta">
                            <span className="fw-semibold">
                              {msg.is_staff ? 'Support' : msg.created_by_name}
                            </span>
                            <span className="text-muted">
                              {formatMessageTime(msg.created_at)}
                            </span>
                          </div>
                          <div
                            className="support-ticket-chat-bubble-body"
                            dangerouslySetInnerHTML={{ __html: msg.body }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {canReply ? (
                <div className="support-ticket-chat-composer border-top px-3 py-2">
                  {sendError && (
                    <p className="text-danger small mb-2" role="alert">
                      {sendError}
                    </p>
                  )}
                  <div className="support-ticket-chat-editor mb-2">
                    <Editor
                      {...TINYMCE_EDITOR_SHARED_PROPS}
                      key={editorKey}
                      value={replyDraft}
                      onInit={(_evt, editor) => {
                        editorRef.current = editor
                      }}
                      onEditorChange={(content) => setReplyDraft(content)}
                      init={SUPPORT_CHAT_EDITOR_INIT}
                    />
                  </div>
                  <div className="d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={sending}
                      onClick={() => void handleSend()}
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-top px-3 py-2">
                  <p className="text-muted small mb-0">
                    {isAdmin
                      ? 'You have read-only access to this ticket.'
                      : 'This ticket is closed for replies.'}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {canDelete && onDelete ? (
                <button
                  type="button"
                  className="btn btn-outline-danger me-auto"
                  disabled={deleting}
                  onClick={() => void onDelete()}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default SupportTicketChatModal
