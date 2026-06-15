import { useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMCEEditor } from 'tinymce'
import type { EmailRecord, EmailPayload } from '../services/emails'
import {
  downloadEmailAttachment,
  normalizeEmailAttachments,
} from '../services/emails'
import {
  fetchEmailBookingTemplates,
  findCompanyDefaultBookingTemplate,
  type EmailBookingTemplateRecord,
} from '../services/emailBookingTemplates'
import { fetchCompanies, type CompanyRecord } from '../services/companies'
import { fetchMe, type UserRecord } from '../services/users'
import DocumentsModal from './DocumentsModal'
import type { DocumentRecord } from '../services/documents'
import { applyEmailMergeVariables } from '../lib/applyEmailMergeVariables'
import { buildEmailMergeContext } from '../lib/emailMergeContext'
import { hasMeaningfulEmailBody } from '../lib/emailBody'
import {
  createEmailBodyEditorInit,
  SUBJECT_VARIABLES_ONLY_EDITOR_INIT,
} from '../lib/tinymceEmailMergeVariables'
import { TINYMCE_EDITOR_SHARED_PROPS } from '../lib/tinymceFreeEditor'
import { normalizeEmailList } from '../lib/emailRecipients'
import { EmailRecipientFields } from './EmailRecipientFields'
import {
  attachmentFilenameFromUrl,
  downloadSecuredFile,
} from '../lib/securedFileUrl'
import { showErrorToast } from '../utils/toast'
import {
  emailLogDisplayTimeZone,
  formatAppDateTime,
} from '../lib/formatDateTime'

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
  /** Prefill compose fields (ignored when ``email`` is set). */
  composeDefaults?: Partial<EmailPayload>
  /** Separate localStorage draft key for compose mode (e.g. per booking). */
  draftScope?: string
  /** Apply this quotation template (``name``) when templates load. */
  initialBookingTemplateName?: string
  /** Replace ``{payment_link}`` in subject/body on send. */
  paymentLinkUrl?: string
  /** Optional quotation merge values used by TinyMCE variables. */
  quotationId?: string | number | null
  quotationTitle?: string | null
  transactionId?: string | null
  amountPaid?: string | number | null
  /** Scope booking templates to the logged-in user's company. */
  bookingTemplateCompanyId?: number | null
  /** Render above booking payments modal (z-index stack). */
  stacked?: boolean
  /** When false, modal is view-only (no send/resend). */
  canWrite?: boolean
}

const EMPTY_FORM: EmailPayload = {
  to: [],
  cc: [],
  bcc: [],
  reply_to: '',
  subject: '',
  body: '',
  attachments: [],
}

const DRAFT_PREFIX = 'emailDraft:'

function draftKey(email?: EmailRecord | null, draftScope?: string): string {
  if (email) return `${DRAFT_PREFIX}${email.id}`
  if (draftScope) return `${DRAFT_PREFIX}${draftScope}`
  return `${DRAFT_PREFIX}compose`
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

function buildInitialForm(
  email?: EmailRecord | null,
  composeDefaults?: Partial<EmailPayload>,
  defaultReplyTo = '',
): EmailPayload {
  if (email) {
    return {
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      reply_to: email.reply_to ?? '',
      subject: email.subject,
      body: email.body,
      attachments: normalizeEmailAttachments(email.attachments).map((item) => item.url),
    }
  }
  const base: EmailPayload = { ...EMPTY_FORM, ...composeDefaults }
  if (!base.reply_to?.trim() && defaultReplyTo) {
    base.reply_to = defaultReplyTo
  }
  return base
}

const EmailSenderModal = ({
  email,
  error,
  sending,
  onSend,
  onClose,
  composeDefaults,
  draftScope,
  initialBookingTemplateName,
  paymentLinkUrl,
  quotationId,
  quotationTitle,
  transactionId,
  amountPaid,
  bookingTemplateCompanyId,
  stacked = false,
  canWrite = true,
}: EmailSenderModalProps) => {
  const layerClass = stacked ? ' email-modal--stacked' : ''
  const isCompose = !email
  const storageKey = draftKey(email, draftScope)

  const [restoredDraft, setRestoredDraft] = useState(
    () => !!loadDraft(storageKey),
  )
  const [form, setForm] = useState<EmailPayload>(() => {
    const draft = loadDraft(storageKey)
    return draft ?? buildInitialForm(email, composeDefaults)
  })
  const [editorKey, setEditorKey] = useState(0)
  const editorRef = useRef<TinyMCEEditor | null>(null)
  const initialHtmlRef = useRef(form.body ?? '')
  const initialSubjectRef = useRef(form.subject ?? '')
  const [docsMode, setDocsMode] = useState<'insert' | 'attach' | null>(null)
  const [defaultReplyTo, setDefaultReplyTo] = useState('')
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null)
  const [mergeCompany, setMergeCompany] = useState<CompanyRecord | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [bookingTemplates, setBookingTemplates] = useState<EmailBookingTemplateRecord[]>([])
  const [bookingTemplatesLoading, setBookingTemplatesLoading] = useState(false)
  const [selectedBookingTemplateId, setSelectedBookingTemplateId] = useState('')
  const initialTemplateAppliedRef = useRef(false)
  const [downloadingAttachmentIdx, setDownloadingAttachmentIdx] = useState<number | null>(
    null,
  )

  const activeBookingTemplates = useMemo(
    () => bookingTemplates.filter((t) => t.is_active),
    [bookingTemplates],
  )

  const attachmentFilenameByUrl = useMemo(() => {
    if (!email) return new Map<string, string>()
    return new Map(
      normalizeEmailAttachments(email.attachments).map((item) => [
        item.url,
        item.filename,
      ]),
    )
  }, [email])

  useEffect(() => {
    if (!isCompose) return
    let cancelled = false
    setBookingTemplatesLoading(true)
    fetchEmailBookingTemplates(
      '',
      bookingTemplateCompanyId != null ? bookingTemplateCompanyId : undefined,
    )
      .then((rows) => {
        if (!cancelled) setBookingTemplates(rows)
      })
      .catch(() => {
        if (!cancelled) setBookingTemplates([])
      })
      .finally(() => {
        if (!cancelled) setBookingTemplatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isCompose, bookingTemplateCompanyId])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchMe(), fetchCompanies()])
      .then(([user, companies]) => {
        if (cancelled) return
        setCurrentUser(user)
        setDefaultReplyTo(user.email?.trim() ?? '')
        const companyId =
          bookingTemplateCompanyId ?? user.company ?? null
        const company =
          companyId != null
            ? companies.find((c) => c.id === companyId) ?? null
            : null
        setMergeCompany(company)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [bookingTemplateCompanyId])

  useEffect(() => {
    if (!isCompose || !defaultReplyTo) return
    setForm((prev) => {
      if (prev.reply_to?.trim()) return prev
      const next = { ...prev, reply_to: defaultReplyTo }
      saveDraft(storageKey, next)
      return next
    })
  }, [isCompose, defaultReplyTo, storageKey])

  const defaultAttachmentUrls = useMemo(
    () => (composeDefaults?.attachments ?? []).filter(Boolean),
    [composeDefaults?.attachments],
  )

  useEffect(() => {
    if (!isCompose || !defaultAttachmentUrls.length) return
    setForm((prev) => {
      const current = prev.attachments ?? []
      const missing = defaultAttachmentUrls.filter((url) => !current.includes(url))
      if (!missing.length) return prev
      const next = { ...prev, attachments: [...current, ...missing] }
      saveDraft(storageKey, next)
      return next
    })
  }, [isCompose, defaultAttachmentUrls, storageKey])

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

  const applyBookingTemplate = (template: EmailBookingTemplateRecord) => {
    const subject = template.subject ?? ''
    const body = template.body ?? ''
    initialSubjectRef.current = subject
    initialHtmlRef.current = body
    setForm((prev) => {
      const next = {
        ...prev,
        subject,
        body,
        cc: normalizeEmailList(template.cc ?? []),
        bcc: normalizeEmailList(template.bcc ?? []),
      }
      saveDraft(storageKey, next)
      return next
    })
    setEditorKey((k) => k + 1)
  }

  useEffect(() => {
    if (
      !isCompose ||
      !initialBookingTemplateName ||
      bookingTemplatesLoading ||
      bookingTemplateCompanyId == null
    ) {
      return
    }
    if (initialTemplateAppliedRef.current) {
      return
    }
    const template = findCompanyDefaultBookingTemplate(
      bookingTemplates,
      initialBookingTemplateName,
      bookingTemplateCompanyId,
    )
    if (!template) {
      return
    }
    initialTemplateAppliedRef.current = true
    applyBookingTemplate(template)
    setSelectedBookingTemplateId(String(template.id))
  }, [
    isCompose,
    initialBookingTemplateName,
    bookingTemplates,
    bookingTemplatesLoading,
    bookingTemplateCompanyId,
  ])

  const handleBookingTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedBookingTemplateId(value)
    if (!value) return
    const template = activeBookingTemplates.find((t) => String(t.id) === value)
    if (template) applyBookingTemplate(template)
  }

  const handleReset = () => {
    clearDraft(storageKey)
    setRestoredDraft(false)
    const fresh = buildInitialForm(email, composeDefaults, defaultReplyTo)
    setForm(fresh)
    initialHtmlRef.current = fresh.body ?? ''
    initialSubjectRef.current = fresh.subject ?? ''
    setSelectedBookingTemplateId('')
    setEditorKey((k) => k + 1)
  }

  const bodyForSend = (): string =>
    editorRef.current?.getContent() ?? form.body ?? ''

  const attachmentLabel = (url: string) =>
    attachmentFilenameByUrl.get(url) ?? attachmentFilenameFromUrl(url)

  const handleDownloadAttachment = async (url: string, idx: number) => {
    setDownloadingAttachmentIdx(idx)
    try {
      if (!isCompose && email) {
        await downloadEmailAttachment(email.id, idx, attachmentLabel(url))
      } else {
        await downloadSecuredFile(url, attachmentLabel(url))
      }
    } catch {
      showErrorToast('Could not download attachment.')
    } finally {
      setDownloadingAttachmentIdx(null)
    }
  }

  const handleSendClick = () => {
    const body = bodyForSend()
    if (!hasMeaningfulEmailBody(body)) {
      setValidationError('Please enter a message body.')
      return
    }
    setValidationError(null)
    clearDraft(storageKey)
    const mergeContext = buildEmailMergeContext({
      user: currentUser,
      company: mergeCompany,
      paymentLinkUrl: paymentLinkUrl ?? '',
      quotationId,
      quotationTitle,
      transactionId,
      amountPaid,
    })
    const subject = applyEmailMergeVariables(form.subject ?? '', mergeContext)
    const mergedBody = applyEmailMergeVariables(body, mergeContext)
    onSend({ ...form, body: mergedBody, subject })
  }

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [onClose])

  return (
    <>
      <div
        className={`email-modal-backdrop modal-backdrop fade show${layerClass}`}
        onClick={onClose}
      />
      <div
        className={`email-modal modal fade show d-block${layerClass}`}
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
              {(validationError || error) && (
                <div className="alert alert-danger py-2" role="alert">
                  {validationError || error}
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
                  <EmailRecipientFields
                    fields={['to', 'cc', 'bcc']}
                    value={{
                      to: form.to ?? [],
                      cc: form.cc ?? [],
                      bcc: form.bcc ?? [],
                    }}
                    onChange={({ to, cc, bcc }) => {
                      setForm((prev) => {
                        const next = { ...prev, to, cc, bcc }
                        saveDraft(storageKey, next)
                        return next
                      })
                    }}
                    disabled={sending || !canWrite}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label" htmlFor="email-reply-to">
                    Reply-To
                  </label>
                  <input
                    id="email-reply-to"
                    type="email"
                    className="form-control form-control-sm"
                    placeholder="reply@example.com"
                    value={form.reply_to ?? ''}
                    onChange={(e) => setField('reply_to', e.target.value.trim())}
                  />
                </div>
                {isCompose && (
                  <div className="col-12">
                    <label className="form-label" htmlFor="email-booking-template">
                      Email template
                    </label>
                    <select
                      id="email-booking-template"
                      className="form-select form-select-sm"
                      value={selectedBookingTemplateId}
                      onChange={handleBookingTemplateChange}
                      disabled={bookingTemplatesLoading || sending}
                    >
                      <option value="">
                        {bookingTemplatesLoading
                          ? 'Loading templates…'
                          : activeBookingTemplates.length
                            ? 'Select a template…'
                            : 'No quotation templates'}
                      </option>
                      {activeBookingTemplates.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.title || t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-12">
                  <label className="form-label">Subject</label>
                  <div className="email-subject-editor">
                    <Editor
                      {...TINYMCE_EDITOR_SHARED_PROPS}
                      key={`subject-${editorKey}`}
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
                  {...TINYMCE_EDITOR_SHARED_PROPS}
                  key={editorKey}
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
                  init={createEmailBodyEditorInit({
                    height: 350,
                    onOpenDocuments: () => setDocsMode('insert'),
                  })}
                />
              </div>

              <div className="mt-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <label className="form-label mb-0">Attachments</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setDocsMode('attach')}
                    disabled={!canWrite || sending}
                  >
                    <i className="bi bi-paperclip me-1" />
                    Attach
                  </button>
                </div>
                {(form.attachments ?? []).length > 0 ? (
                  <div className="attachment-list">
                    {(form.attachments ?? []).map((url, idx) => {
                      const filename = attachmentLabel(url)
                      const downloading = downloadingAttachmentIdx === idx
                      return (
                        <div key={idx} className="attachment-item">
                          <i className="bi bi-file-earmark me-1" />
                          <button
                            type="button"
                            className="attachment-name attachment-name-btn"
                            title={url}
                            disabled={downloading}
                            onClick={() => void handleDownloadAttachment(url, idx)}
                          >
                            {filename}
                          </button>
                          <button
                            type="button"
                            className="attachment-download"
                            disabled={downloading}
                            onClick={() => void handleDownloadAttachment(url, idx)}
                            aria-label={`Download ${filename}`}
                            title="Download"
                          >
                            {downloading ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              />
                            ) : (
                              <i className="bi bi-download" />
                            )}
                          </button>
                          {canWrite && (
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
                          )}
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
                    {formatAppDateTime(
                      email.created_at,
                      emailLogDisplayTimeZone(
                        email,
                        mergeCompany ? [mergeCompany] : [],
                      ),
                    )}
                  </div>
                  {email.sent_at && (
                    <div className="col-auto">
                      <strong>Sent:</strong>{' '}
                      {formatAppDateTime(
                        email.sent_at,
                        emailLogDisplayTimeZone(
                          email,
                          mergeCompany ? [mergeCompany] : [],
                        ),
                      )}
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
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSendClick}
                  disabled={
                    sending ||
                    (!(form.to ?? []).length &&
                      !(form.cc ?? []).length &&
                      !(form.bcc ?? []).length) ||
                    !hasMeaningfulEmailBody(bodyForSend())
                  }
                >
                  <i className="bi bi-send me-1" />
                  {sending ? 'Sending...' : isCompose ? 'Send' : 'Resend'}
                </button>
              )}
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
