import { useCallback, useEffect, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { registerEmailMergeVariablesToolbar, SUBJECT_VARIABLES_ONLY_EDITOR_INIT } from '../../lib/tinymceEmailMergeVariables'
import {
  createEmailUserTemplate,
  deleteEmailUserTemplate,
  fetchEmailUserTemplates,
  updateEmailUserTemplate,
  type EmailUserTemplatePayload,
  type EmailUserTemplateRecord,
} from '../../services/emailUserTemplates'

/** Form state shown in the UI; `name` is derived from `title` when saving (hidden from user). */
type EmailUserTemplateFormFields = Omit<EmailUserTemplatePayload, 'name'>

const EMPTY_FORM: EmailUserTemplateFormFields = {
  title: '',
  subject: '',
  body: '',
  is_active: true,
}

function formFromRecord(r: EmailUserTemplateRecord): EmailUserTemplateFormFields {
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

function toApiPayload(
  form: EmailUserTemplateFormFields,
  mode: 'create' | 'edit',
  existingName?: string,
): EmailUserTemplatePayload {
  return {
    name: mode === 'create' ? titleToTemplateName(form.title) : (existingName ?? 'untitled'),
    title: form.title.trim(),
    subject: form.subject,
    body: form.body,
    is_active: form.is_active,
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

const TEMPLATE_BODY_EDITOR_INIT = {
  height: 360,
  menubar: false,
  toolbar_mode: 'wrap' as const,
  plugins: [
    'advlist',
    'autolink',
    'lists',
    'link',
    'image',
    'charmap',
    'preview',
    'anchor',
    'searchreplace',
    'visualblocks',
    'code',
    'fullscreen',
    'insertdatetime',
    'media',
    'table',
    'help',
    'wordcount',
  ],
  toolbar:
    'undo redo | blocks | bold italic forecolor | ' +
    'alignleft aligncenter alignright alignjustify | ' +
    'bullist numlist outdent indent | link image table | ' +
    'emailmergevars | removeformat code | help',
  setup: (editor) => {
    registerEmailMergeVariablesToolbar(editor)
  },
  content_style:
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; }',
}

const UsersEmailTemplatesPanel = () => {
  const [templates, setTemplates] = useState<EmailUserTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<EmailUserTemplateRecord | null>(null)
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState<EmailUserTemplateFormFields>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<EmailUserTemplateRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bodyEditorKey, setBodyEditorKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await fetchEmailUserTemplates())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setComposing(true)
    setFormError(null)
    setBodyEditorKey((k) => k + 1)
  }

  const openEdit = (t: EmailUserTemplateRecord) => {
    setEditing(t)
    setForm(formFromRecord(t))
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

  const setField = <K extends keyof EmailUserTemplateFormFields>(
    key: K,
    value: EmailUserTemplateFormFields[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = editing
        ? toApiPayload(form, 'edit', editing.name)
        : toApiPayload(form, 'create')
      if (editing) {
        await updateEmailUserTemplate(editing.id, payload)
      } else {
        await createEmailUserTemplate(payload)
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
      await deleteEmailUserTemplate(deleteTarget.id)
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {templates.length} template{templates.length !== 1 && 's'} (type: users)
        </span>
        <button type="button" className="btn btn-sm btn-primary" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1" />
          New template
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading && templates.length === 0 ? (
        <div className="text-muted">Loading...</div>
      ) : templates.length === 0 && !showFormModal ? (
        <div className="text-muted small">No user email templates yet.</div>
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
                {!t.is_active && <span className="badge bg-secondary mt-1">Inactive</span>}
              </div>
              <div className="d-flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => openEdit(t)}
                >
                  <i className="bi bi-pencil" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => setDeleteTarget(t)}
                >
                  <i className="bi bi-trash" />
                </button>
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
                    <label className="form-label" htmlFor="et-title">
                      Title *
                    </label>
                    <input
                      id="et-title"
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
                        key={`subject-${bodyEditorKey}`}
                        tinymceScriptSrc="/tinymce/tinymce.min.js"
                        licenseKey="gpl"
                        initialValue={form.subject}
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
                  <div className="mb-3">
                    <span className="form-label d-block mb-2">Body</span>
                    <Editor
                      key={bodyEditorKey}
                      tinymceScriptSrc="/tinymce/tinymce.min.js"
                      licenseKey="gpl"
                      initialValue={form.body}
                      onEditorChange={(content) => setField('body', content)}
                      init={TEMPLATE_BODY_EDITOR_INIT}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="et-active"
                      className="form-check-input"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setField('is_active', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="et-active">
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

const EmailTemplatesSettingsPage = () => {
  const [usersOpen, setUsersOpen] = useState(false)

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <li className={`faq-item${usersOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={usersOpen}
            onClick={() => setUsersOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-people" />
            </span>
            <span className="faq-question">Users</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {usersOpen && (
            <div className="faq-answer faq-answer--form">
              <UsersEmailTemplatesPanel />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

export default EmailTemplatesSettingsPage
