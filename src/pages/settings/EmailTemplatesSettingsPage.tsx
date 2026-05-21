import { useCallback, useEffect, useRef, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMCEEditor } from 'tinymce'
import DocumentsModal from '../../components/DocumentsModal'
import {
  createEmailBodyEditorInit,
  SUBJECT_VARIABLES_ONLY_EDITOR_INIT,
} from '../../lib/tinymceEmailMergeVariables'
import type { DocumentRecord } from '../../services/documents'
import {
  createEmailBookingTemplate,
  deleteEmailBookingTemplate,
  fetchEmailBookingTemplates,
  updateEmailBookingTemplate,
  type EmailBookingTemplatePayload,
  type EmailBookingTemplateRecord,
} from '../../services/emailBookingTemplates'
import {
  createEmailUserTemplate,
  deleteEmailUserTemplate,
  fetchEmailUserTemplates,
  updateEmailUserTemplate,
  type EmailUserTemplatePayload,
  type EmailUserTemplateRecord,
} from '../../services/emailUserTemplates'
import { fetchActiveCompanies, type CompanyRecord } from '../../services/companies'
import { fetchMe } from '../../services/users'

type EmailTemplateRecord = EmailUserTemplateRecord | EmailBookingTemplateRecord
type EmailTemplatePayload = EmailUserTemplatePayload | EmailBookingTemplatePayload

/** Form state shown in the UI; `name` is derived from `title` when saving (hidden from user). */
type EmailTemplateFormFields = Omit<EmailTemplatePayload, 'name'>

const EMPTY_FORM: EmailTemplateFormFields = {
  title: '',
  subject: '',
  body: '',
  is_active: true,
}

function pickDefaultCompanyId(
  companies: CompanyRecord[],
  userCompanyId: number | null,
): number | null {
  if (userCompanyId != null && companies.some((c) => c.id === userCompanyId)) {
    return userCompanyId
  }
  if (companies.length === 0) return null
  const main = companies.find((c) => c.is_main)
  return main?.id ?? companies[0].id
}

type EmailTemplatesPanelConfig = {
  typeLabel: string
  emptyMessage: string
  fetchTemplates: (
    search?: string,
    companyId?: number | null,
  ) => Promise<EmailTemplateRecord[]>
  createTemplate: (data: EmailTemplatePayload) => Promise<EmailTemplateRecord>
  updateTemplate: (
    id: number,
    data: Partial<EmailTemplatePayload>,
  ) => Promise<EmailTemplateRecord>
  deleteTemplate: (id: number) => Promise<void>
}

function formFromRecord(r: EmailTemplateRecord): EmailTemplateFormFields {
  return {
    title: r.title || r.name,
    subject: r.subject,
    body: r.body,
    is_active: r.is_active,
  }
}

/** Display title → stable snake_case `name`: lowercase, accents stripped, non-alphanumeric → `_`. */
function titleToTemplateName(raw: string): string {
  const s = raw.trim().toLowerCase()
  const snake = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
  const out = snake || 'untitled'
  return out.length > 255 ? out.slice(0, 255).replace(/_+$/, '') || 'untitled' : out
}

function normalizeSubject(subject: string): string {
  return subject.replace(/\s+/g, ' ').trim()
}

function toApiPayload(
  form: EmailTemplateFormFields,
  mode: 'create' | 'edit',
  existingName?: string,
  companyId?: number | null,
): EmailTemplatePayload {
  return {
    name: mode === 'create' ? titleToTemplateName(form.title) : (existingName ?? 'untitled'),
    title: form.title.trim(),
    subject: normalizeSubject(form.subject),
    body: form.body,
    is_active: form.is_active,
    ...(companyId != null ? { company_id: companyId } : {}),
  }
}

function bodyPreview(body: string, max = 80): string {
  const text = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return '—'
  return text.length > max ? `${text.slice(0, max)}…` : text
}

const EmailTemplatesPanel = ({
  typeLabel,
  emptyMessage,
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
}: EmailTemplatesPanelConfig) => {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [userCompanyId, setUserCompanyId] = useState<number | null>(null)

  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<EmailTemplateRecord | null>(null)
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState<EmailTemplateFormFields>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<EmailTemplateRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bodyEditorKey, setBodyEditorKey] = useState(0)
  const [docsModalOpen, setDocsModalOpen] = useState(false)
  const bodyEditorRef = useRef<TinyMCEEditor | null>(null)
  const initialSubjectRef = useRef('')
  const initialBodyRef = useRef('')

  const handleDocSelect = (doc: DocumentRecord) => {
    const editor = bodyEditorRef.current
    if (!editor) {
      setDocsModalOpen(false)
      return
    }
    if (doc.is_image) {
      editor.insertContent(
        `<img src="${doc.url}" alt="${doc.original_name}" style="max-width:100%;" />`,
      )
    } else {
      editor.insertContent(
        `<a href="${doc.url}" target="_blank">${doc.original_name}</a>`,
      )
    }
    setDocsModalOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    setCompaniesLoading(true)
    void Promise.all([fetchActiveCompanies(), fetchMe()])
      .then(([companyRows, user]) => {
        if (cancelled) return
        setCompanies(companyRows)
        setUserCompanyId(user.company)
        setSelectedCompanyId((prev) => {
          if (prev != null && companyRows.some((c) => c.id === prev)) return prev
          return pickDefaultCompanyId(companyRows, user.company)
        })
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load companies')
        }
      })
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    if (selectedCompanyId == null) {
      setTemplates([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setTemplates(await fetchTemplates('', selectedCompanyId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [fetchTemplates, selectedCompanyId])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    initialSubjectRef.current = ''
    initialBodyRef.current = ''
    setEditing(null)
    setForm(EMPTY_FORM)
    setComposing(true)
    setFormError(null)
    setBodyEditorKey((k) => k + 1)
  }

  const openEdit = (t: EmailTemplateRecord) => {
    const fields = formFromRecord(t)
    initialSubjectRef.current = fields.subject
    initialBodyRef.current = fields.body
    setEditing(t)
    setForm(fields)
    setComposing(false)
    setFormError(null)
    setBodyEditorKey((k) => k + 1)
  }

  const closeModal = () => {
    setEditing(null)
    setComposing(false)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  const setField = <K extends keyof EmailTemplateFormFields>(
    key: K,
    value: EmailTemplateFormFields[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (userCompanyId == null) {
      setFormError('Your user account has no company; cannot save templates.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = editing
        ? toApiPayload(form, 'edit', editing.name, userCompanyId)
        : toApiPayload(form, 'create', undefined, userCompanyId)
      if (editing) {
        await updateTemplate(editing.id, payload)
      } else {
        await createTemplate(payload)
      }
      await load()
      closeModal()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTemplate(deleteTarget.id)
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) closeModal()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const showFormModal = (composing || editing !== null) && !deleteTarget
  const canCreate = userCompanyId != null && !companiesLoading

  return (
    <div>
      <div className="row g-2 align-items-end mb-3">
        <div className="col-sm-8 col-md-6">
          <label className="form-label mb-1" htmlFor={`email-templates-company-${typeLabel}`}>
            Company
          </label>
          <select
            id={`email-templates-company-${typeLabel}`}
            className="form-select form-select-sm"
            value={selectedCompanyId ?? ''}
            disabled={companiesLoading || companies.length === 0}
            onChange={(e) => {
              const id = Number(e.target.value)
              setSelectedCompanyId(Number.isFinite(id) && id > 0 ? id : null)
              closeModal()
            }}
          >
            {companies.length === 0 ? (
              <option value="">No active companies</option>
            ) : (
              companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.is_main ? ' (main)' : ''}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {templates.length} template{templates.length !== 1 && 's'} (type: {typeLabel})
        </span>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={openAdd}
          disabled={!canCreate}
        >
          <i className="bi bi-plus-lg me-1" />
          New template
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading && templates.length === 0 ? (
        <div className="text-muted">Loading...</div>
      ) : templates.length === 0 && !showFormModal ? (
        <div className="text-muted small">{emptyMessage}</div>
      ) : null}

      {templates.length > 0 && (
        <div className="list-group mb-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-start text-start"
              onClick={() => openEdit(t)}
            >
              <div>
                <strong>{t.title || t.name || '—'}</strong>
                <div className="text-muted small">{t.subject || '—'}</div>
                <div className="text-muted small">{bodyPreview(t.body)}</div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {t.is_default && (
                    <span className="badge bg-light text-dark border">Default</span>
                  )}
                  {!t.is_active && <span className="badge bg-secondary">Inactive</span>}
                </div>
              </div>
              <div className="d-flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => openEdit(t)}
                >
                  <i className="bi bi-pencil" />
                </button>
                {!t.is_default && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => setDeleteTarget(t)}
                    aria-label={`Delete ${t.title || t.name}`}
                  >
                    <i className="bi bi-trash" />
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showFormModal && (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <form onSubmit={handleSave}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    {editing ? 'Edit template' : 'New template'}
                  </h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeModal} />
                </div>
                <div className="modal-body">
                  {formError && <div className="alert alert-danger py-2">{formError}</div>}
                  <div className="mb-3">
                    <label className="form-label" htmlFor={`et-title-${typeLabel}`}>
                      Title *
                    </label>
                    <input
                      id={`et-title-${typeLabel}`}
                      className="form-control"
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <span className="form-label d-block mb-2">Subject</span>
                    <div className="email-subject-editor">
                      <Editor
                        key={`subject-${typeLabel}-${bodyEditorKey}`}
                        tinymceScriptSrc="/tinymce/tinymce.min.js"
                        licenseKey="gpl"
                        initialValue={initialSubjectRef.current}
                        onEditorChange={(_html, ed) => {
                          setField('subject', ed.getContent({ format: 'text' }))
                        }}
                        init={SUBJECT_VARIABLES_ONLY_EDITOR_INIT}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <span className="form-label d-block mb-2">Body</span>
                    <Editor
                      key={`body-${typeLabel}-${bodyEditorKey}`}
                      tinymceScriptSrc="/tinymce/tinymce.min.js"
                      licenseKey="gpl"
                      onInit={(_evt, editor) => {
                        bodyEditorRef.current = editor
                      }}
                      initialValue={initialBodyRef.current}
                      onEditorChange={(content) => setField('body', content)}
                      init={createEmailBodyEditorInit({
                        height: 360,
                        onOpenDocuments: () => setDocsModalOpen(true),
                      })}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id={`et-active-${typeLabel}`}
                      className="form-check-input"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setField('is_active', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor={`et-active-${typeLabel}`}>
                      Active
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
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
      )}

      {showFormModal && (
        <div className="modal-backdrop fade show" aria-hidden="true" onClick={closeModal} />
      )}

      {docsModalOpen && (
        <DocumentsModal
          onSelect={handleDocSelect}
          onClose={() => setDocsModalOpen(false)}
        />
      )}

      {deleteTarget && (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete template</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setDeleteTarget(null)}
                />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  Remove <strong>{deleteTarget.title || deleteTarget.name}</strong> from the list?
                  The template will be archived (soft-deleted).
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleting}
                  onClick={confirmDelete}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && <div className="modal-backdrop fade show" aria-hidden="true" />}
    </div>
  )
}

type AccordionItemProps = {
  open: boolean
  onToggle: () => void
  icon: string
  title: string
  children: React.ReactNode
}

const EmailTemplatesAccordionItem = ({ open, onToggle, icon, title, children }: AccordionItemProps) => (
  <li className={`faq-item${open ? ' is-open' : ''}`}>
    <button
      type="button"
      className="faq-toggle"
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="faq-icon" aria-hidden="true">
        <i className={icon} />
      </span>
      <span className="faq-question">{title}</span>
      <span className="faq-chevron" aria-hidden="true">
        <i className="bi bi-chevron-down" />
      </span>
    </button>
    {open && <div className="faq-answer faq-answer--form">{children}</div>}
  </li>
)

const USERS_PANEL_CONFIG: EmailTemplatesPanelConfig = {
  typeLabel: 'users',
  emptyMessage: 'No user email templates yet.',
  fetchTemplates: fetchEmailUserTemplates,
  createTemplate: createEmailUserTemplate,
  updateTemplate: updateEmailUserTemplate,
  deleteTemplate: deleteEmailUserTemplate,
}

const BOOKINGS_PANEL_CONFIG: EmailTemplatesPanelConfig = {
  typeLabel: 'bookings',
  emptyMessage: 'No booking email templates yet.',
  fetchTemplates: fetchEmailBookingTemplates,
  createTemplate: createEmailBookingTemplate,
  updateTemplate: updateEmailBookingTemplate,
  deleteTemplate: deleteEmailBookingTemplate,
}

const EmailTemplatesSettingsPage = () => {
  const [usersOpen, setUsersOpen] = useState(false)
  const [bookingsOpen, setBookingsOpen] = useState(false)

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <EmailTemplatesAccordionItem
          open={usersOpen}
          onToggle={() => setUsersOpen((prev) => !prev)}
          icon="bi bi-people"
          title="Users"
        >
          <EmailTemplatesPanel {...USERS_PANEL_CONFIG} />
        </EmailTemplatesAccordionItem>
        <EmailTemplatesAccordionItem
          open={bookingsOpen}
          onToggle={() => setBookingsOpen((prev) => !prev)}
          icon="bi bi-calendar-check"
          title="Bookings"
        >
          <EmailTemplatesPanel {...BOOKINGS_PANEL_CONFIG} />
        </EmailTemplatesAccordionItem>
      </ul>
    </div>
  )
}

export default EmailTemplatesSettingsPage
