import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  fetchFormTemplates,
  createFormTemplate,
  updateFormTemplate,
  deleteFormTemplate,
  FIELD_TYPE_OPTIONS,
  type FormTemplateRecord,
  type FormTemplatePayload,
  type TemplateField,
  type FieldOption,
  type FieldType,
} from '../../services/formTemplates'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TPL_PARAM = 'tpl'

const DRAFT_PREFIX = 'tplDraft:'

const EMPTY_OPTION: Omit<FieldOption, 'id'> = {
  label: '',
  price: null,
  sort_order: 0,
}

const EMPTY_FIELD: Omit<TemplateField, 'id'> = {
  label: '',
  field_type: 'text',
  is_required: false,
  options: [],
  price: null,
  sort_order: 0,
}

const EMPTY_FORM: FormTemplatePayload = {
  name: '',
  description: '',
  is_active: true,
  is_default: false,
  fields: [],
}

/* ------------------------------------------------------------------ */
/*  Draft helpers (localStorage)                                       */
/* ------------------------------------------------------------------ */

function draftKey(id?: number | null): string {
  return id ? `${DRAFT_PREFIX}${id}` : `${DRAFT_PREFIX}new`
}

function loadDraft(key: string): FormTemplatePayload | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as FormTemplatePayload) : null
  } catch {
    return null
  }
}

function saveDraft(key: string, data: FormTemplatePayload) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* quota exceeded — silently ignore */ }
}

function clearDraft(key: string) {
  localStorage.removeItem(key)
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formFromRecord(r: FormTemplateRecord): FormTemplatePayload {
  return {
    name: r.name,
    description: r.description,
    is_active: r.is_active,
    is_default: r.is_default,
    fields: r.fields.map((f) => ({
      label: f.label,
      field_type: f.field_type,
      is_required: f.is_required,
      options: f.options.map((o) => ({
        label: o.label,
        price: o.price,
        sort_order: o.sort_order,
      })),
      price: f.price,
      sort_order: f.sort_order,
    })),
  }
}

/* ------------------------------------------------------------------ */
/*  BookingsSettingsPage                                                */
/* ------------------------------------------------------------------ */

const BookingsSettingsPage = () => {
  const [open, setOpen] = useState(true)

  return (
    <div className="account-settings">
      <ul className="faq-list">
        <li className={`faq-item${open ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-ui-checks-grid" />
            </span>
            <span className="faq-question">Form Templates</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {open && (
            <div className="faq-answer faq-answer--form">
              <FormTemplatesPanel />
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Form Templates panel (list + modal editor)                         */
/* ------------------------------------------------------------------ */

const FormTemplatesPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [templates, setTemplates] = useState<FormTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<FormTemplateRecord | null>(null)
  const [composing, setComposing] = useState(
    () => searchParams.get(TPL_PARAM) === 'new',
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<FormTemplateRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  /* -- URL param helpers -- */
  const writeTplParam = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set(TPL_PARAM, value)
      return next
    }, { replace: true })
  }

  const clearTplParam = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(TPL_PARAM)
      return next
    }, { replace: true })
  }

  /* -- data loading -- */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await fetchFormTemplates())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /* -- sticky modal: re-populate editing from URL after data refresh -- */
  useEffect(() => {
    const tplId = searchParams.get(TPL_PARAM)
    if (!tplId || tplId === 'new') return
    const template = templates.find((t) => String(t.id) === tplId)
    if (!template) {
      if (!loading) clearTplParam()
      return
    }
    if (
      editing &&
      editing.id === template.id &&
      editing.updated_at === template.updated_at
    )
      return
    setEditing(template)
    setComposing(false)
    setFormError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates, loading])

  /* -- open / close -- */
  const openAdd = () => {
    writeTplParam('new')
    setEditing(null)
    setComposing(true)
    setFormError(null)
  }

  const openEdit = (t: FormTemplateRecord) => {
    writeTplParam(String(t.id))
  }

  const closeModal = () => {
    clearTplParam()
    setEditing(null)
    setComposing(false)
    setFormError(null)
  }

  /* -- save -- */
  const handleSave = async (payload: FormTemplatePayload) => {
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateFormTemplate(editing.id, payload)
      } else {
        const created = await createFormTemplate(payload)
        writeTplParam(String(created.id))
      }
      await load()
      closeModal()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  /* -- delete -- */
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteFormTemplate(deleteTarget.id)
      setDeleteTarget(null)
      if (editing && editing.id === deleteTarget.id) closeModal()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const showModal = !!(editing || composing)

  return (
    <div>
      {/* Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {templates.length} template{templates.length !== 1 && 's'}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={openAdd}
        >
          <i className="bi bi-plus-lg me-1" />
          New Template
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading && templates.length === 0 ? (
        <div className="text-muted">Loading...</div>
      ) : templates.length === 0 && !showModal ? (
        <div className="text-muted small">
          No form templates yet. Click &quot;New Template&quot; to create one.
        </div>
      ) : null}

      {/* Template list */}
      {templates.length > 0 && (
        <div className="list-group mb-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center${
                editing?.id === t.id ? ' active' : ''
              }`}
              style={{ cursor: 'pointer' }}
              onClick={() => openEdit(t)}
            >
              <div>
                <strong>{t.name}</strong>
                <span className="text-muted ms-2 small">
                  {t.fields.length} field{t.fields.length !== 1 && 's'}
                </span>
                {t.is_default && (
                  <span className="badge bg-primary ms-2">Default</span>
                )}
                {!t.is_active && (
                  <span className="badge bg-secondary ms-2">Inactive</span>
                )}
              </div>
              <div className="d-flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  title="Edit"
                  onClick={() => openEdit(t)}
                >
                  <i className="bi bi-pencil-square" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  title="Delete"
                  onClick={() => setDeleteTarget(t)}
                >
                  <i className="bi bi-trash3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {showModal && (
        <TemplateFormModal
          template={editing}
          error={formError}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <>
          <div
            className="user-details-modal-backdrop modal-backdrop fade show"
            onClick={() => setDeleteTarget(null)}
          />
          <div
            className="user-details-modal modal fade show d-block"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h1 className="modal-title fs-5">Delete Template</h1>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setDeleteTarget(null)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Are you sure you want to delete{' '}
                    <strong>{deleteTarget.name}</strong>? This action cannot be
                    undone.
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
                    onClick={confirmDelete}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
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

/* ------------------------------------------------------------------ */
/*  Template form modal                                                */
/* ------------------------------------------------------------------ */

type TemplateFormModalProps = {
  template: FormTemplateRecord | null
  error: string | null
  saving: boolean
  onSave: (payload: FormTemplatePayload) => void
  onClose: () => void
}

const TemplateFormModal = ({
  template,
  error,
  saving,
  onSave,
  onClose,
}: TemplateFormModalProps) => {
  const isEdit = !!template
  const storageKey = draftKey(template?.id)

  const [restoredDraft, setRestoredDraft] = useState(
    () => !!loadDraft(storageKey),
  )
  const [form, setForm] = useState<FormTemplatePayload>(() => {
    const draft = loadDraft(storageKey)
    return draft ?? (template ? formFromRecord(template) : { ...EMPTY_FORM })
  })

  const persistForm = (next: FormTemplatePayload) => {
    setForm(next)
    saveDraft(storageKey, next)
  }

  const setField = <K extends keyof FormTemplatePayload>(
    key: K,
    val: FormTemplatePayload[K],
  ) => {
    persistForm({ ...form, [key]: val })
  }

  const handleReset = () => {
    clearDraft(storageKey)
    setRestoredDraft(false)
    setForm(template ? formFromRecord(template) : { ...EMPTY_FORM })
  }

  /* -- field helpers -- */
  const addField = () =>
    persistForm({
      ...form,
      fields: [...form.fields, { ...EMPTY_FIELD, sort_order: form.fields.length }],
    })

  const updateField = (idx: number, patch: Partial<Omit<TemplateField, 'id'>>) =>
    persistForm({
      ...form,
      fields: form.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    })

  const removeField = (idx: number) =>
    persistForm({
      ...form,
      fields: form.fields.filter((_, i) => i !== idx),
    })

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= form.fields.length) return
    const next = [...form.fields]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    persistForm({ ...form, fields: next })
  }

  const addOption = (fieldIdx: number) =>
    updateField(fieldIdx, {
      options: [
        ...form.fields[fieldIdx].options,
        { ...EMPTY_OPTION, sort_order: form.fields[fieldIdx].options.length },
      ],
    })

  const updateOption = (
    fieldIdx: number,
    optIdx: number,
    patch: Partial<Omit<FieldOption, 'id'>>,
  ) => {
    const updated = form.fields[fieldIdx].options.map((o, i) =>
      i === optIdx ? { ...o, ...patch } : o,
    )
    updateField(fieldIdx, { options: updated })
  }

  const removeOption = (fieldIdx: number, optIdx: number) =>
    updateField(fieldIdx, {
      options: form.fields[fieldIdx].options.filter((_, i) => i !== optIdx),
    })

  const moveOption = (fieldIdx: number, optIdx: number, dir: -1 | 1) => {
    const opts = form.fields[fieldIdx].options
    const target = optIdx + dir
    if (target < 0 || target >= opts.length) return
    const next = [...opts]
    ;[next[optIdx], next[target]] = [next[target], next[optIdx]]
    updateField(fieldIdx, { options: next })
  }

  /* -- drag-and-drop: fields -- */
  const fieldDragIdx = useRef<number | null>(null)
  const [fieldDragOver, setFieldDragOver] = useState<number | null>(null)

  const handleFieldDragStart = (e: DragEvent<HTMLElement>, idx: number) => {
    fieldDragIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', String(idx)) } catch { /* noop */ }
  }

  const handleFieldDragOver = (e: DragEvent<HTMLElement>, idx: number) => {
    if (fieldDragIdx.current === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (fieldDragOver !== idx) setFieldDragOver(idx)
  }

  const handleFieldDrop = (e: DragEvent<HTMLElement>, targetIdx: number) => {
    e.preventDefault()
    const sourceIdx = fieldDragIdx.current
    if (sourceIdx === null || sourceIdx === targetIdx) {
      fieldDragIdx.current = null
      setFieldDragOver(null)
      return
    }
    const next = [...form.fields]
    const [moved] = next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, moved)
    persistForm({ ...form, fields: next })
    fieldDragIdx.current = null
    setFieldDragOver(null)
  }

  const handleFieldDragEnd = () => {
    fieldDragIdx.current = null
    setFieldDragOver(null)
  }

  /* -- drag-and-drop: options -- */
  const optDragRef = useRef<{ fieldIdx: number; optIdx: number } | null>(null)
  const [optDragOver, setOptDragOver] = useState<{ fieldIdx: number; optIdx: number } | null>(null)

  const handleOptDragStart = (e: DragEvent<HTMLElement>, fieldIdx: number, optIdx: number) => {
    optDragRef.current = { fieldIdx, optIdx }
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', `${fieldIdx}-${optIdx}`) } catch { /* noop */ }
  }

  const handleOptDragOver = (e: DragEvent<HTMLElement>, fieldIdx: number, optIdx: number) => {
    const src = optDragRef.current
    if (!src || src.fieldIdx !== fieldIdx) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (optDragOver?.fieldIdx !== fieldIdx || optDragOver?.optIdx !== optIdx) {
      setOptDragOver({ fieldIdx, optIdx })
    }
  }

  const handleOptDrop = (e: DragEvent<HTMLElement>, fieldIdx: number, targetIdx: number) => {
    e.preventDefault()
    const src = optDragRef.current
    if (!src || src.fieldIdx !== fieldIdx || src.optIdx === targetIdx) {
      optDragRef.current = null
      setOptDragOver(null)
      return
    }
    const opts = [...form.fields[fieldIdx].options]
    const [moved] = opts.splice(src.optIdx, 1)
    opts.splice(targetIdx, 0, moved)
    updateField(fieldIdx, { options: opts })
    optDragRef.current = null
    setOptDragOver(null)
  }

  const handleOptDragEnd = () => {
    optDragRef.current = null
    setOptDragOver(null)
  }

  /* -- validation + submit -- */
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = () => {
    setLocalError(null)
    if (!form.name.trim()) {
      setLocalError('Template name is required.')
      return
    }
    for (const f of form.fields) {
      if (!f.label.trim()) {
        setLocalError('All fields must have a label.')
        return
      }
      if (f.field_type === 'select' && f.options.filter((o) => o.label.trim()).length < 1) {
        setLocalError(`Dropdown field "${f.label}" needs at least one option.`)
        return
      }
    }
    const payload: FormTemplatePayload = {
      ...form,
      fields: form.fields.map((f, idx) => ({ ...f, sort_order: idx })),
    }
    clearDraft(storageKey)
    onSave(payload)
  }

  /* -- body overflow lock + Escape -- */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayError = error || localError

  return (
    <>
      <div className="user-details-modal-backdrop modal-backdrop fade show" onClick={onClose} />
      <div
        className="user-details-modal modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tplModalTitle"
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="tplModalTitle" className="modal-title fs-5">
                {isEdit ? 'Edit Template' : 'New Template'}
              </h1>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {displayError && (
                <div className="alert alert-danger py-2">{displayError}</div>
              )}

              {restoredDraft && (
                <div className="alert alert-info py-2 mb-3 d-flex align-items-center" role="status">
                  <i className="bi bi-save me-2" />
                  <span className="flex-grow-1">
                    We restored your unsaved draft so you can pick up where you left off.
                  </span>
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-sm-8">
                  <label className="form-label">Template Name *</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </div>
                <div className="col-sm-4 d-flex align-items-end gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="tplActive"
                      checked={form.is_active}
                      onChange={(e) => setField('is_active', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="tplActive">
                      Active
                    </label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="tplDefault"
                      checked={form.is_default}
                      onChange={(e) => setField('is_default', e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="tplDefault">
                      Default
                    </label>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                  />
                </div>
              </div>

              {/* UDF fields */}
              <div className="d-flex align-items-center gap-2 mb-2">
                <h6 className="mb-0">Fields (UDFs)</h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={addField}
                >
                  <i className="bi bi-plus-lg me-1" />Add Field
                </button>
              </div>

              {form.fields.length === 0 && (
                <div className="text-muted small mb-3">
                  No fields defined yet. Click &quot;Add Field&quot; to start building the form.
                </div>
              )}

              {form.fields.map((field, idx) => (
                <div
                  key={idx}
                  className={`card card-body p-3 mb-2${fieldDragOver === idx ? ' border-primary' : ''}`}
                  draggable
                  onDragStart={(e) => handleFieldDragStart(e, idx)}
                  onDragOver={(e) => handleFieldDragOver(e, idx)}
                  onDrop={(e) => handleFieldDrop(e, idx)}
                  onDragEnd={handleFieldDragEnd}
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <i
                        className="bi bi-grip-vertical text-muted"
                        style={{ cursor: 'grab', fontSize: '1.1rem' }}
                        title="Drag to reorder"
                      />
                      <span className="badge bg-light text-dark">#{idx + 1}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      title="Remove field"
                      onClick={() => removeField(idx)}
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                  <div className="row g-2">
                    <div className="col-sm-4">
                      <label className="form-label">Label *</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="Field label"
                        value={field.label}
                        onChange={(e) => updateField(idx, { label: e.target.value })}
                      />
                    </div>
                    <div className="col-sm-3">
                      <label className="form-label">Type</label>
                      <select
                        className="form-select form-select-sm"
                        value={field.field_type}
                        onChange={(e) =>
                          updateField(idx, { field_type: e.target.value as FieldType })
                        }
                      >
                        {FIELD_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {field.field_type !== 'select' && (
                      <div className="col-sm-3">
                        <label className="form-label">Price</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          value={field.price ?? ''}
                          onChange={(e) =>
                            updateField(idx, {
                              price: e.target.value === '' ? null : e.target.value,
                            })
                          }
                        />
                      </div>
                    )}
                    <div className={`${field.field_type === 'select' ? 'col-sm-5' : 'col-sm-2'} d-flex align-items-end`}>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`req-${idx}`}
                          checked={field.is_required}
                          onChange={(e) =>
                            updateField(idx, { is_required: e.target.checked })
                          }
                        />
                        <label className="form-check-label" htmlFor={`req-${idx}`}>
                          Required
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Options (for dropdown fields) */}
                  {field.field_type === 'select' && (
                    <div className="mt-2">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <small className="text-muted fw-semibold">Options</small>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-1"
                          onClick={() => addOption(idx)}
                        >
                          <i className="bi bi-plus" />
                        </button>
                      </div>
                      {field.options.length === 0 && (
                        <div className="text-muted small">No options added.</div>
                      )}
                      {field.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className={`row g-1 mb-1 align-items-center${
                            optDragOver?.fieldIdx === idx && optDragOver?.optIdx === optIdx
                              ? ' border-primary rounded'
                              : ''
                          }`}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation()
                            handleOptDragStart(e, idx, optIdx)
                          }}
                          onDragOver={(e) => {
                            e.stopPropagation()
                            handleOptDragOver(e, idx, optIdx)
                          }}
                          onDrop={(e) => {
                            e.stopPropagation()
                            handleOptDrop(e, idx, optIdx)
                          }}
                          onDragEnd={handleOptDragEnd}
                        >
                          <div className="col-auto d-flex align-items-center">
                            <i
                              className="bi bi-grip-vertical text-muted"
                              style={{ cursor: 'grab', fontSize: '0.9rem' }}
                              title="Drag to reorder"
                            />
                          </div>
                          <div className="col">
                            <input
                              className="form-control form-control-sm"
                              placeholder={`Option ${optIdx + 1}`}
                              value={opt.label}
                              onChange={(e) =>
                                updateOption(idx, optIdx, { label: e.target.value })
                              }
                            />
                          </div>
                          <div className="col-auto" style={{ width: '110px' }}>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              placeholder="Price"
                              step="0.01"
                              min="0"
                              value={opt.price ?? ''}
                              onChange={(e) =>
                                updateOption(idx, optIdx, {
                                  price: e.target.value === '' ? null : e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="col-auto">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              title="Remove"
                              onClick={() => removeOption(idx, optIdx)}
                            >
                              <i className="bi bi-x-lg" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-footer">
              {restoredDraft && (
                <button
                  type="button"
                  className="btn btn-outline-warning me-auto"
                  onClick={handleReset}
                  disabled={saving}
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
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default BookingsSettingsPage
