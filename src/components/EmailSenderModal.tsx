import { useEffect, useRef, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMCEEditor } from 'tinymce'
import type { EmailRecord, EmailPayload } from '../services/emails'
import DocumentsModal from './DocumentsModal'
import type { DocumentRecord } from '../services/documents'

/* ------------------------------------------------------------------ */
/*  Inline email-list input (input + add button + tag list)            */
/* ------------------------------------------------------------------ */

type EmailListInputProps = {
  label: string
  emails: string[]
  onChange: (emails: string[]) => void
}

const EmailListInput = ({ label, emails, onChange }: EmailListInputProps) => {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addEmails = () => {
    const incoming = draft
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (incoming.length === 0) return
    const unique = incoming.filter((e) => !emails.includes(e))
    if (unique.length) onChange([...emails, ...unique])
    setDraft('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addEmails()
    }
  }

  const remove = (idx: number) => {
    onChange(emails.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="input-group input-group-sm">
        <input
          ref={inputRef}
          type="email"
          className="form-control"
          placeholder="Add email address..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={addEmails}
          disabled={!draft.trim()}
        >
          <i className="bi bi-plus-lg" />
        </button>
      </div>
      {emails.length > 0 && (
        <div className="email-tag-list">
          {emails.map((addr, idx) => (
            <span key={idx} className="email-tag">
              {addr}
              <button
                type="button"
                className="email-tag-remove"
                onClick={() => remove(idx)}
                aria-label={`Remove ${addr}`}
              >
                <i className="bi bi-x" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const statusBadge = (status: EmailRecord['status']) => {
  const cls =
    status === 'sent'
      ? 'emails-status--sent'
      : status === 'failed'
        ? 'emails-status--failed'
        : 'emails-status--queued'
  return <span className={`emails-status ${cls}`}>{status}</span>
}

export type EmailSenderModalProps = {
  /** The existing email record (for viewing/resending). */
  email: EmailRecord
  /** Error message to display at the top of the modal. */
  error: string | null
  /** Whether the send/resend request is in flight. */
  sending: boolean
  /** Called with the (possibly edited) payload when the user clicks Send/Resend. */
  onSend: (data: EmailPayload) => void
  /** Called when the modal should close. */
  onClose: () => void
}

const EmailSenderModal = ({
  email,
  error,
  sending,
  onSend,
  onClose,
}: EmailSenderModalProps) => {
  const [form, setForm] = useState<EmailPayload>({
    to: email.to,
    cc: email.cc,
    bcc: email.bcc,
    email_from: email.email_from,
    subject: email.subject,
    body_html: email.body_html,
    body_text: email.body_text,
    attachments: email.attachments,
  })
  const editorRef = useRef<TinyMCEEditor | null>(null)
  const [showDocs, setShowDocs] = useState(false)

  const handleDocSelect = (doc: DocumentRecord) => {
    const editor = editorRef.current
    if (!editor) return
    if (doc.is_image) {
      editor.insertContent(
        `<img src="${doc.url}" alt="${doc.original_name}" style="max-width:100%;" />`,
      )
    } else {
      editor.insertContent(
        `<a href="${doc.url}" target="_blank">${doc.original_name}</a>`,
      )
    }
    setShowDocs(false)
  }

  const setField = <K extends keyof EmailPayload>(
    key: K,
    val: EmailPayload[K],
  ) => setForm((prev) => ({ ...prev, [key]: val }))

  // Escape to close
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handler)
    }
  }, [onClose])

  return (
    <>
      <div
        className="email-modal-backdrop modal-backdrop fade show"
        onClick={onClose}
      />
      <div
        className="email-modal modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emailSenderTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="emailSenderTitle" className="modal-title fs-5">
                Email #{email.id}
                <span className="ms-2">{statusBadge(email.status)}</span>
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              )}
              {email.error && (
                <div className="alert alert-warning py-2 mb-3" role="alert">
                  <strong>Last error:</strong> {email.error}
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">From</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email_from ?? ''}
                    onChange={(e) => setField('email_from', e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <EmailListInput
                    label="To"
                    emails={form.to ?? []}
                    onChange={(val) => setField('to', val)}
                  />
                </div>
                <div className="col-md-6">
                  <EmailListInput
                    label="CC"
                    emails={form.cc ?? []}
                    onChange={(val) => setField('cc', val)}
                  />
                </div>
                <div className="col-md-6">
                  <EmailListInput
                    label="BCC"
                    emails={form.bcc ?? []}
                    onChange={(val) => setField('bcc', val)}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label">Subject</label>
                  <input
                    className="form-control"
                    value={form.subject ?? ''}
                    onChange={(e) => setField('subject', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Body</label>
                <Editor
                  tinymceScriptSrc="/tinymce/tinymce.min.js"
                  licenseKey="gpl"
                  onInit={(_evt, editor) => {
                    editorRef.current = editor
                  }}
                  initialValue={form.body_html ?? ''}
                  onEditorChange={(content) =>
                    setField('body_html', content)
                  }
                  init={{
                    height: 350,
                    menubar: false,
                    plugins: [
                      'advlist', 'autolink', 'lists', 'link', 'image',
                      'charmap', 'preview', 'anchor', 'searchreplace',
                      'visualblocks', 'code', 'fullscreen',
                      'insertdatetime', 'media', 'table', 'help',
                      'wordcount',
                    ],
                    toolbar:
                      'undo redo | blocks | bold italic forecolor | ' +
                      'alignleft aligncenter alignright alignjustify | ' +
                      'bullist numlist outdent indent | link image table | ' +
                      'documents | removeformat code | help',
                    setup: (editor) => {
                      editor.ui.registry.addButton('documents', {
                        icon: 'browse',
                        tooltip: 'Insert from Documents',
                        onAction: () => setShowDocs(true),
                      })
                    },
                    content_style:
                      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }',
                  }}
                />
              </div>

              <div className="mt-3">
                <label className="form-label">
                  Attachments{' '}
                  <span className="text-muted small">(one URL per line)</span>
                </label>
                <textarea
                  className="form-control email-body-textarea"
                  rows={3}
                  value={(form.attachments ?? []).join('\n')}
                  onChange={(e) =>
                    setField(
                      'attachments',
                      e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>

              <div className="row g-2 mt-2 text-muted small">
                <div className="col-auto">
                  <strong>Attempts:</strong> {email.attempts}
                </div>
                <div className="col-auto">
                  <strong>Created:</strong>{' '}
                  {new Date(email.created_at).toLocaleString()}
                </div>
                {email.sent_at && (
                  <div className="col-auto">
                    <strong>Sent:</strong>{' '}
                    {new Date(email.sent_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={sending}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onSend(form)}
                disabled={sending}
              >
                <i className="bi bi-send me-1" />
                {sending ? 'Sending...' : 'Resend'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDocs && (
        <DocumentsModal
          onSelect={handleDocSelect}
          onClose={() => setShowDocs(false)}
        />
      )}
    </>
  )
}

export default EmailSenderModal
