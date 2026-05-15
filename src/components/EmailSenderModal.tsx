import { useEffect, useRef, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMCEEditor } from 'tinymce'
import type { EmailRecord, EmailPayload } from '../services/emails'
import DocumentsModal from './DocumentsModal'
import type { DocumentRecord } from '../services/documents'
import {
  registerEmailMergeVariablesToolbar,
  SUBJECT_VARIABLES_ONLY_EDITOR_INIT,
} from '../lib/tinymceEmailMergeVariables'

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
  /** The existing email record (for viewing/resending). Omit for compose mode. */
  email?: EmailRecord | null
  /** Error message to display at the top of the modal. */
  error: string | null
  /** Whether the send/resend request is in flight. */
  sending: boolean
  /** Called with the (possibly edited) payload when the user clicks Send/Resend. */
  onSend: (data: EmailPayload) => void
  /** Called when the modal should close. */
  onClose: () => void
}

const EMPTY_FORM: EmailPayload = {
  to: [],
  cc: [],
  bcc: [],
  email_from: '',
  subject: '',
  body: '',
  attachments: [],
}

const DRAFT_PREFIX = 'emailDraft:'

function draftKey(email?: EmailRecord | null): string {
  return email ? `${DRAFT_PREFIX}${email.id}` : `${DRAFT_PREFIX}compose`
}

function loadDraft(key: string): EmailPayload | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as EmailPayload) : null
  } catch {
    return null
  }
}

function saveDraft(key: string, data: EmailPayload) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* quota exceeded — silently ignore */ }
}

function clearDraft(key: string) {
  localStorage.removeItem(key)
}

function buildInitialForm(email?: EmailRecord | null): EmailPayload {
  return email
    ? {
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        email_from: email.email_from,
        subject: email.subject,
        body: email.body,
        attachments: email.attachments,
      }
    : { ...EMPTY_FORM }
}

const EmailSenderModal = ({
  email,
  error,
  sending,
  onSend,
  onClose,
}: EmailSenderModalProps) => {
  const isCompose = !email
  const storageKey = draftKey(email)

  const [restoredDraft, setRestoredDraft] = useState(
    () => !!loadDraft(storageKey),
  )
  const [form, setForm] = useState<EmailPayload>(() => {
    const draft = loadDraft(storageKey)
    return draft ?? buildInitialForm(email)
  })
  const [editorKey, setEditorKey] = useState(0)
  const editorRef = useRef<TinyMCEEditor | null>(null)
  const initialHtmlRef = useRef(form.body ?? '')
  const initialSubjectRef = useRef(form.subject ?? '')
  const [docsMode, setDocsMode] = useState<'insert' | 'attach' | null>(null)

  const handleDocSelect = (doc: DocumentRecord) => {
    if (docsMode === 'attach') {
      const current = form.attachments ?? []
      if (!current.includes(doc.url)) {
        setField('attachments', [...current, doc.url])
      }
      setDocsMode(null)
      return
    }
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
    setDocsMode(null)
  }

  const setField = <K extends keyof EmailPayload>(
    key: K,
    val: EmailPayload[K],
  ) =>
    setForm((prev) => {
      const next = { ...prev, [key]: val }
      saveDraft(storageKey, next)
      return next
    })

  const handleReset = () => {
    clearDraft(storageKey)
    setRestoredDraft(false)
    const fresh = buildInitialForm(email)
    setForm(fresh)
    initialHtmlRef.current = fresh.body ?? ''
    initialSubjectRef.current = fresh.subject ?? ''
    setEditorKey((k) => k + 1)
  }

  const handleSend = (data: EmailPayload) => {
    clearDraft(storageKey)
    onSend(data)
  }

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
                {isCompose ? (
                  <>
                    <i className="bi bi-pencil-square me-2" />
                    Compose Email
                  </>
                ) : (
                  <>
                    Email #{email.id}
                    <span className="ms-2">{statusBadge(email.status)}</span>
                  </>
                )}
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
              {!isCompose && email.error && (
                <div className="alert alert-warning py-2 mb-3" role="alert">
                  <strong>Last error:</strong> {email.error}
                </div>
              )}
              {restoredDraft && (
                <div className="alert alert-info py-2 mb-3 d-flex align-items-center" role="status">
                  <i className="bi bi-save me-2" />
                  <span className="flex-grow-1">
                    Your previous draft has been restored.
                    Click <strong>Reset</strong> to discard it and start fresh.
                  </span>
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-12">
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
                  <div className="email-subject-editor">
                    <Editor
                      key={`subject-${editorKey}`}
                      tinymceScriptSrc="/tinymce/tinymce.min.js"
                      licenseKey="gpl"
                      initialValue={initialSubjectRef.current}
                      onEditorChange={(_html, ed) => {
                        const text = ed
                          .getContent({ format: 'text' })
                          .replace(/\s+/g, ' ')
                          .trim()
                        setField('subject', text)
                      }}
                      init={SUBJECT_VARIABLES_ONLY_EDITOR_INIT}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Body</label>
                <Editor
                  key={editorKey}
                  tinymceScriptSrc="/tinymce/tinymce.min.js"
                  licenseKey="gpl"
                  onInit={(_evt, editor) => {
                    editorRef.current = editor
                  }}
                  initialValue={initialHtmlRef.current}
                  onEditorChange={(content) => {
                    setForm((prev) => {
                      const next = { ...prev, body: content }
                      saveDraft(storageKey, next)
                      return next
                    })
                  }}
                  init={{
                    height: 350,
                    menubar: false,
                    toolbar_mode: 'wrap',
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
                      'documents emailmergevars | removeformat code | help',
                    setup: (editor) => {
                      editor.ui.registry.addButton('documents', {
                        icon: 'browse',
                        tooltip: 'Insert from Documents',
                        onAction: () => setDocsMode('insert'),
                      })
                      registerEmailMergeVariablesToolbar(editor)
                    },
                    content_style:
                      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }',
                  }}
                />
              </div>

              <div className="mt-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <label className="form-label mb-0">Attachments</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setDocsMode('attach')}
                  >
                    <i className="bi bi-paperclip me-1" />
                    Attach
                  </button>
                </div>
                {(form.attachments ?? []).length > 0 ? (
                  <div className="attachment-list">
                    {(form.attachments ?? []).map((url, idx) => {
                      const filename = url.split('/').pop() || url
                      return (
                        <div key={idx} className="attachment-item">
                          <i className="bi bi-file-earmark me-1" />
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="attachment-name"
                            title={url}
                          >
                            {filename}
                          </a>
                          <button
                            type="button"
                            className="attachment-remove"
                            onClick={() =>
                              setField(
                                'attachments',
                                (form.attachments ?? []).filter((_, i) => i !== idx),
                              )
                            }
                            aria-label={`Remove ${filename}`}
                          >
                            <i className="bi bi-x" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-muted small">No attachments</div>
                )}
              </div>

              {!isCompose && (
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
              )}
            </div>
            <div className="modal-footer">
              {restoredDraft && (
                <button
                  type="button"
                  className="btn btn-outline-warning me-auto"
                  onClick={handleReset}
                  disabled={sending}
                  title="Discard draft and reset to original"
                >
                  <i className="bi bi-arrow-counterclockwise me-1" />
                  Reset
                </button>
              )}
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
                onClick={() => handleSend(form)}
                disabled={
                  sending ||
                  (!(form.to ?? []).length &&
                    !(form.cc ?? []).length &&
                    !(form.bcc ?? []).length)
                }
              >
                <i className="bi bi-send me-1" />
                {sending ? 'Sending...' : isCompose ? 'Send' : 'Resend'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {docsMode && (
        <DocumentsModal
          onSelect={handleDocSelect}
          onClose={() => setDocsMode(null)}
        />
      )}
    </>
  )
}

export default EmailSenderModal
