import { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import type { DragEvent, FormEvent } from 'react'
import {
  FIELD_TYPE_OPTIONS,
  type FieldType,
} from '../services/formTemplates'
import { storedValueToTimeInput, timeInputToStored } from '../lib/timeInput'
import {
  DEFAULT_BOOKING_GROUP_NAME,
  mergeBookingFieldGroups,
  normalizeBookingGroupName,
} from '../lib/bookingFieldGroups'
import {
  getBookingPriceGroups,
  resolveBookingFieldPriceRaw,
  sumBookingPriceGroups,
} from '../lib/bookingPriceSummary'
import { fetchBookingsGroupNameConfig } from '../services/config'
import { fetchCurrentAccount } from '../services/accounts'
import {
  formatCurrency,
  localeFromIso2,
  type CurrencyFormatOptions,
} from '../utils/currency'
import SupplierFieldInput from './SupplierFieldInput'
import { showErrorToast } from '../utils/toast'

export type BookingFieldOption = {
  label: string
  price: string | null
  sort_order: number
}

export type BookingField = {
  label: string
  group_name: string
  booking_group_id?: number | null
  field_type: FieldType
  is_required: boolean
  options: BookingFieldOption[]
  price: string | null
  sort_order: number
  saved: boolean
  value: string
}

export type BookingFormState = {
  mode: 'create' | 'edit'
  id: number | null
  columnId: number
  title: string
  dateOfEvent: string
  timeOfEvent: string
  templateId: number | null
  fields: BookingField[]
  /** Empty group accordions (no fields yet); persisted via booking ``groups`` on save. */
  extraGroupNames?: string[]
  notes: string
}

export type BookingStatus = {
  id: number
  title: string
}

export type BookingTemplateField = {
  label: string
  field_type: FieldType
  is_required: boolean
  options: { label: string; price: string | null; sort_order: number }[]
  price: string | null
  sort_order: number
}

export type BookingTemplate = {
  id: number
  name: string
  is_default: boolean
  fields: BookingTemplateField[]
}

export type BookingGroupRef = {
  id: number
  name: string
}

type BookingEditModalProps = {
  form: BookingFormState
  statuses: BookingStatus[]
  templates: BookingTemplate[]
  bookingGroups?: BookingGroupRef[]
  onChange: (next: BookingFormState) => void
  onDeleteGroup?: (bookingId: number, groupId: number) => Promise<void>
  onClose: () => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
}

const EMPTY_FIELD: BookingField = {
  label: '',
  group_name: DEFAULT_BOOKING_GROUP_NAME,
  field_type: 'text',
  is_required: false,
  options: [],
  price: null,
  sort_order: 0,
  saved: false,
  value: '',
}

const EMPTY_OPTION: BookingFieldOption = {
  label: '',
  price: null,
  sort_order: 0,
}

const DRAFT_KEY_PREFIX = 'bookingDraft:'

type DraftData = Omit<BookingFormState, 'mode' | 'id'>

function draftKey(templateId: number | null, bookingId: number | null): string {
  const tplPart = templateId != null ? String(templateId) : 'none'
  const idPart = bookingId != null ? String(bookingId) : 'new'
  return `${DRAFT_KEY_PREFIX}${tplPart}:${idPart}`
}

function loadDraft(key: string): DraftData | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as DraftData) : null
  } catch {
    return null
  }
}

function saveDraft(key: string, form: BookingFormState) {
  try {
    const { mode: _, id: __, ...data } = form
    localStorage.setItem(key, JSON.stringify(data))
  } catch { /* quota exceeded */ }
}

function isDraftNonEmpty(data: Partial<BookingFormState>): boolean {
  if (data.title && data.title.trim()) return true
  if (data.dateOfEvent && data.dateOfEvent.trim()) return true
  if (data.timeOfEvent && data.timeOfEvent.trim()) return true
  if (data.notes && data.notes.trim()) return true
  if (data.fields && data.fields.length > 0) return true
  return false
}

export function clearBookingDraft(templateId: number | null, bookingId: number | null) {
  localStorage.removeItem(draftKey(templateId, bookingId))
}

const BookingEditModal = ({
  form,
  statuses,
  templates,
  bookingGroups = [],
  onChange,
  onDeleteGroup,
  onClose,
  onSubmit,
}: BookingEditModalProps) => {
  const [fieldDragOver, setFieldDragOver] = useState<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [restoredDraft, setRestoredDraft] = useState(false)
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyFormatOptions>({
    currencyCode: 'USD',
    locale: 'en-US',
  })
  const [defaultGroupName, setDefaultGroupName] = useState(DEFAULT_BOOKING_GROUP_NAME)
  const [extraGroupNames, setExtraGroupNames] = useState<string[]>(
    form.extraGroupNames ?? [],
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [showAddGroupModal, setShowAddGroupModal] = useState(false)
  const [newGroupInput, setNewGroupInput] = useState('')
  const [addGroupError, setAddGroupError] = useState<string | null>(null)
  const originalFormJson = useRef(JSON.stringify(form))
  const groupLabel = defaultGroupName
  const skipSave = useRef(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCurrentAccount(), fetchBookingsGroupNameConfig()])
      .then(([account, groupConfig]) => {
        if (cancelled) return
        setCurrencyOptions({
          currencyCode: account.country_currency_code || 'USD',
          locale: localeFromIso2(account.country_iso2_code),
        })
        const name = groupConfig.value?.trim()
        if (name) setDefaultGroupName(name)
      })
      .catch(() => {
        // Keep defaults.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const groupIdByName = useMemo(() => {
    const map = new Map<string, number>()
    for (const group of bookingGroups) {
      map.set(normalizeBookingGroupName(group.name), group.id)
    }
    for (const field of form.fields) {
      if (field.booking_group_id != null) {
        map.set(normalizeBookingGroupName(field.group_name), field.booking_group_id)
      }
    }
    return map
  }, [bookingGroups, form.fields])

  const fieldGroups = useMemo(
    () => mergeBookingFieldGroups(form.fields, extraGroupNames, bookingGroups),
    [form.fields, extraGroupNames, bookingGroups],
  )

  useEffect(() => {
    const namesWithFields = new Set(
      form.fields.map((f) => normalizeBookingGroupName(f.group_name)),
    )
    const emptyFromApi = bookingGroups
      .map((g) => normalizeBookingGroupName(g.name))
      .filter((name) => !namesWithFields.has(name))
    if (emptyFromApi.length === 0) return
    setExtraGroupNames((prev) => {
      const merged = [...prev]
      let changed = false
      for (const name of emptyFromApi) {
        if (!merged.includes(name)) {
          merged.push(name)
          changed = true
        }
      }
      return changed ? merged : prev
    })
  }, [bookingGroups, form.fields])

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev }
      let changed = false
      fieldGroups.forEach((group, index) => {
        if (next[group.groupName] === undefined) {
          next[group.groupName] = index === 0
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [fieldGroups])

  const priceGroups = useMemo(
    () => getBookingPriceGroups(fieldGroups),
    [fieldGroups],
  )
  const priceTotal = useMemo(
    () => sumBookingPriceGroups(priceGroups),
    [priceGroups],
  )

  const formatFieldPriceAmount = (raw: string | null | undefined): string | null => {
    if (raw === null || raw === undefined || raw === '') return null
    const amount = Number(raw)
    if (Number.isNaN(amount)) return String(raw)
    return formatCurrency(amount, currencyOptions)
  }

  const getSavedFieldDisplayPrice = (field: BookingField): string | null =>
    formatFieldPriceAmount(resolveBookingFieldPriceRaw(field))

  // Restore draft on mount
  useEffect(() => {
    originalFormJson.current = JSON.stringify(form)
    const key = draftKey(form.templateId, form.id)
    const draft = loadDraft(key)
    if (draft && isDraftNonEmpty(draft)) {
      onChange({ ...form, ...draft })
      setRestoredDraft(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft on every form change (skip initial render)
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    const key = draftKey(form.templateId, form.id)
    if (isDraftNonEmpty(form)) {
      saveDraft(key, form)
    } else {
      localStorage.removeItem(key)
    }
  }, [form])

  const templateFieldsToBookingFields = (tpl: BookingTemplate): BookingField[] =>
    tpl.fields.map((f, idx) => ({
      label: f.label,
      group_name: defaultGroupName,
      field_type: f.field_type,
      is_required: f.is_required,
      options: f.options.map((o) => ({
        label: o.label,
        price: o.price,
        sort_order: o.sort_order,
      })),
      price: f.price,
      sort_order: idx,
      saved: true,
      value: '',
    }))

  const handleTemplateChange = (newTemplateId: number | null) => {
    setRestoredDraft(false)

    // Populate fields from the selected template
    if (newTemplateId != null) {
      const tpl = templates.find((t) => t.id === newTemplateId)
      if (tpl && tpl.fields.length > 0) {
        onChange({ ...form, templateId: newTemplateId, fields: templateFieldsToBookingFields(tpl) })
        return
      }
    }

    // No template or template has no fields — clear fields
    onChange({ ...form, templateId: newTemplateId, fields: [] })
  }

  const handleReset = () => {
    const key = draftKey(form.templateId, form.id)
    localStorage.removeItem(key)
    setRestoredDraft(false)
    onChange(JSON.parse(originalFormJson.current) as BookingFormState)
  }

  const addFieldToGroup = (groupName: string) => {
    const normalized = normalizeBookingGroupName(groupName)
    const booking_group_id = groupIdByName.get(normalized) ?? null
    onChange({
      ...form,
      fields: [
        ...form.fields,
        {
          ...EMPTY_FIELD,
          group_name: normalized,
          booking_group_id,
          sort_order: form.fields.length,
        },
      ],
    })
    setOpenGroups((prev) => ({ ...prev, [normalized]: true }))
  }

  const removeGroupFromForm = (normalized: string) => {
    const nextFields = form.fields.filter(
      (f) => normalizeBookingGroupName(f.group_name) !== normalized,
    )
    const nextExtra = extraGroupNames.filter(
      (n) => normalizeBookingGroupName(n) !== normalized,
    )
    setExtraGroupNames(nextExtra)
    onChange({ ...form, fields: nextFields, extraGroupNames: nextExtra })
    setOpenGroups((prev) => {
      const next = { ...prev }
      delete next[normalized]
      return next
    })
  }

  const deleteFieldGroup = async (groupName: string) => {
    const normalized = normalizeBookingGroupName(groupName)
    const result = await Swal.fire({
      title: `Delete "${groupName}"?`,
      text: 'This will permanently delete the group and all fields in it.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d65a5a',
    })
    if (!result.isConfirmed) return

    const groupId = groupIdByName.get(normalized)
    if (form.mode === 'edit' && form.id != null && groupId != null && onDeleteGroup) {
      try {
        await onDeleteGroup(form.id, groupId)
      } catch {
        await Swal.fire('Error', 'Failed to delete group.', 'error')
        return
      }
    }
    removeGroupFromForm(normalized)
  }

  const toggleFieldGroup = (groupName: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }))
  }

  const openAddGroupModal = () => {
    setNewGroupInput('')
    setAddGroupError(null)
    setShowAddGroupModal(true)
  }

  const closeAddGroupModal = () => {
    setShowAddGroupModal(false)
    setNewGroupInput('')
    setAddGroupError(null)
  }

  const handleAddGroupSave = () => {
    const name = normalizeBookingGroupName(newGroupInput)
    if (!newGroupInput.trim()) {
      setAddGroupError(`Enter a ${groupLabel} name.`)
      return
    }
    if (fieldGroups.some((g) => g.groupName === name)) {
      setAddGroupError(`A ${groupLabel} group with that name already exists.`)
      return
    }
    const nextExtra = [...extraGroupNames, name]
    setExtraGroupNames(nextExtra)
    onChange({ ...form, extraGroupNames: nextExtra })
    setOpenGroups((prev) => ({ ...prev, [name]: true }))
    closeAddGroupModal()
  }

  const updateField = (idx: number, patch: Partial<BookingField>) => {
    onChange({
      ...form,
      fields: form.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    })
  }

  const removeField = (idx: number) => {
    onChange({
      ...form,
      fields: form.fields.filter((_, i) => i !== idx),
    })
  }

  const addOption = (fieldIdx: number) => {
    updateField(fieldIdx, {
      options: [
        ...form.fields[fieldIdx].options,
        { ...EMPTY_OPTION, sort_order: form.fields[fieldIdx].options.length },
      ],
    })
  }

  const updateOption = (
    fieldIdx: number,
    optIdx: number,
    patch: Partial<BookingFieldOption>,
  ) => {
    const updated = form.fields[fieldIdx].options.map((o, i) =>
      i === optIdx ? { ...o, ...patch } : o,
    )
    updateField(fieldIdx, { options: updated })
  }

  const removeOption = (fieldIdx: number, optIdx: number) => {
    updateField(fieldIdx, {
      options: form.fields[fieldIdx].options.filter((_, i) => i !== optIdx),
    })
  }

  const handleFieldDragStart = (e: DragEvent<HTMLElement>, idx: number) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', String(idx)) } catch { /* noop */ }
  }

  const handleFieldDragOver = (e: DragEvent<HTMLElement>, idx: number) => {
    if (dragIdx === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (fieldDragOver !== idx) setFieldDragOver(idx)
  }

  const handleFieldDrop = (e: DragEvent<HTMLElement>, targetIdx: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null)
      setFieldDragOver(null)
      return
    }
    const next = [...form.fields]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(targetIdx, 0, moved)
    onChange({ ...form, fields: next })
    setDragIdx(null)
    setFieldDragOver(null)
  }

  const handleFieldDragEnd = () => {
    setDragIdx(null)
    setFieldDragOver(null)
  }

  const saveField = (idx: number) => {
    const field = form.fields[idx]
    if (!field.label.trim()) {
      showErrorToast('Enter a field label before saving.')
      return
    }
    if (
      field.field_type === 'select' &&
      field.options.filter((o) => o.label.trim()).length < 1
    ) {
      showErrorToast('Add at least one option for dropdown fields.')
      return
    }
    updateField(idx, { saved: true })
  }

  const editField = (idx: number) => {
    updateField(idx, { saved: false })
  }

  const renderUnsavedFieldCard = (idx: number) => {
    const field = form.fields[idx]
    return (
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
              onChange={(e) => {
                const field_type = e.target.value as FieldType
                if (field_type === 'supplier') {
                  updateField(idx, {
                    field_type,
                    price: null,
                    value: '',
                    options: [],
                  })
                  return
                }
                if (field_type === 'select') {
                  updateField(idx, {
                    field_type,
                    price: null,
                    value: '',
                    options:
                      field.options.length > 0
                        ? field.options
                        : [{ ...EMPTY_OPTION }],
                  })
                  return
                }
                updateField(idx, { field_type })
              }}
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {field.field_type !== 'select' && field.field_type !== 'supplier' && (
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
          <div
            className={`${
              field.field_type === 'select' || field.field_type === 'supplier'
                ? 'col-sm-5'
                : 'col-sm-2'
            } d-flex align-items-end`}
          >
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id={`booking-req-${idx}`}
                checked={field.is_required}
                onChange={(e) =>
                  updateField(idx, { is_required: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor={`booking-req-${idx}`}>
                Required
              </label>
            </div>
          </div>
        </div>

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
              <div key={optIdx} className="row g-1 mb-1 align-items-center">
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

        <div className="mt-2 text-end">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => saveField(idx)}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  const renderSavedField = (field: BookingField, idx: number) => {
    const requiredMark = field.is_required ? ' *' : ''
    const fieldLabel = `${field.label}${requiredMark}`
    const displayPrice = getSavedFieldDisplayPrice(field)

    return (
      <div key={idx} className="mb-3 booking-saved-field">
        <div className="booking-field-header">
          <label className="form-label mb-0 booking-field-header__label">
            {fieldLabel}
          </label>
          <div className="booking-field-header__end">
            {displayPrice && (
              <span className="booking-field-price">{displayPrice}</span>
            )}
            <div className="d-flex gap-1">
              <button
                type="button"
                className="btn btn-sm btn-link p-0"
                title="Edit field"
                onClick={() => editField(idx)}
              >
                <i className="bi bi-pencil-square" />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-danger"
                title="Remove field"
                onClick={() => removeField(idx)}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          </div>
        </div>
        {field.field_type === 'text' && (
          <input
            type="text"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
          />
        )}
        {field.field_type === 'textarea' && (
          <textarea
            className="form-control"
            rows={2}
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
          />
        )}
        {field.field_type === 'number' && (
          <input
            type="number"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
          />
        )}
        {field.field_type === 'date' && (
          <input
            type="date"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
          />
        )}
        {field.field_type === 'time' && (
          <input
            type="time"
            className="form-control"
            step={60}
            value={storedValueToTimeInput(field.value)}
            onChange={(e) =>
              updateField(idx, { value: timeInputToStored(e.target.value) })
            }
            required={field.is_required}
          />
        )}
        {field.field_type === 'email' && (
          <input
            type="email"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
          />
        )}
        {field.field_type === 'phone' && (
          <input
            type="tel"
            className="form-control"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
          />
        )}
        {field.field_type === 'checkbox' && (
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id={`booking-field-${idx}`}
              checked={field.value === 'true'}
              onChange={(e) => updateField(idx, { value: e.target.checked ? 'true' : '' })}
              required={field.is_required && field.value !== 'true'}
            />
            <label className="form-check-label" htmlFor={`booking-field-${idx}`}>
              {field.label}
            </label>
          </div>
        )}
        {field.field_type === 'select' && (
          <select
            className="form-select"
            value={field.value}
            onChange={(e) => updateField(idx, { value: e.target.value })}
            required={field.is_required}
          >
            <option value="">Select...</option>
            {field.options.filter((o) => o.label.trim()).map((opt, oi) => {
              const optionPrice = formatFieldPriceAmount(opt.price)
              return (
                <option key={oi} value={opt.label}>
                  {opt.label}
                  {optionPrice ? ` — ${optionPrice}` : ''}
                </option>
              )
            })}
          </select>
        )}
        {field.field_type === 'supplier' && (
          <SupplierFieldInput
            value={field.value}
            onChange={(value, price) =>
              updateField(idx, { value, price: price ?? null })
            }
            required={field.is_required}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <div
        className="booking-edit-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="booking-edit-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookingEditTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <form onSubmit={onSubmit} noValidate>
              <div className="modal-header">
                <h1 id="bookingEditTitle" className="modal-title fs-5">
                  {form.mode === 'create' ? 'New booking' : 'Edit booking'}
                </h1>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              </div>
              <div className="modal-body">
                {restoredDraft && (
                  <div className="alert alert-info py-2 mb-3 d-flex align-items-center" role="status">
                    <i className="bi bi-save me-2" />
                    <span className="flex-grow-1">
                      Your previous draft has been restored. Click Reset to discard it and start fresh.
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning ms-2"
                      onClick={handleReset}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1" />
                      Reset
                    </button>
                  </div>
                )}
                <div className="row align-items-stretch">
                  <div className="col-md-9">
                    <div className="mb-3">
                      <label htmlFor="booking-title" className="form-label">
                        Title
                      </label>
                      <input
                        id="booking-title"
                        type="text"
                        className="form-control"
                        value={form.title}
                        onChange={(e) =>
                          onChange({ ...form, title: e.target.value })
                        }
                        required
                        autoFocus
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Date of Booking</label>
                      <div className="d-flex gap-2">
                        <input
                          id="booking-date"
                          type="date"
                          className="form-control"
                          value={form.dateOfEvent}
                          onChange={(e) =>
                            onChange({ ...form, dateOfEvent: e.target.value })
                          }
                        />
                        <input
                          id="booking-time"
                          type="time"
                          className="form-control"
                          value={form.timeOfEvent}
                          onChange={(e) =>
                            onChange({ ...form, timeOfEvent: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="mb-3 booking-fields-groups">
                      <div className="booking-fields-groups-toolbar">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={openAddGroupModal}
                        >
                          + Add {groupLabel}
                        </button>
                      </div>
                      <ul className="faq-list booking-fields-group-list">
                        {fieldGroups.map((group) => {
                          const isOpen = openGroups[group.groupName] ?? false
                          return (
                            <li
                              key={group.groupName}
                              className={`faq-item${isOpen ? ' is-open' : ''}`}
                            >
                              <button
                                type="button"
                                className="faq-toggle"
                                aria-expanded={isOpen}
                                onClick={() => toggleFieldGroup(group.groupName)}
                              >
                                <span className="faq-icon" aria-hidden="true">
                                  <i className="bi bi-collection" />
                                </span>
                                <span className="faq-question">{group.groupName}</span>
                                <span className="faq-chevron" aria-hidden="true">
                                  <i className="bi bi-chevron-down" />
                                </span>
                              </button>
                              {isOpen && (
                                <div className="faq-answer faq-answer--form">
                                  {group.items.map(({ field, idx }) =>
                                    field.saved ? (
                                      renderSavedField(field, idx)
                                    ) : (
                                      renderUnsavedFieldCard(idx)
                                    ),
                                  )}
                                  {group.items.length === 0 && (
                                    <p className="text-muted small mb-0">
                                      No fields in this group yet.
                                    </p>
                                  )}
                                  <div className="booking-fields-group-actions">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => void deleteFieldGroup(group.groupName)}
                                    >
                                      Delete
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => addFieldToGroup(group.groupName)}
                                    >
                                      + Add Field
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                    <div className="mb-0">
                      <label htmlFor="booking-notes" className="form-label">
                        Notes
                      </label>
                      <textarea
                        id="booking-notes"
                        className="form-control"
                        rows={3}
                        value={form.notes}
                        onChange={(e) =>
                          onChange({ ...form, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="col-md-3 d-flex flex-column booking-edit-modal-sidebar">
                    <div className="mb-3">
                      <label htmlFor="booking-status" className="form-label">
                        Status
                      </label>
                      <select
                        id="booking-status"
                        className="form-select"
                        value={form.columnId}
                        onChange={(e) =>
                          onChange({ ...form, columnId: Number(e.target.value) })
                        }
                      >
                        {statuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="booking-template" className="form-label">
                        Form Template
                      </label>
                      <select
                        id="booking-template"
                        className="form-select"
                        value={form.templateId ?? ''}
                        onChange={(e) =>
                          handleTemplateChange(e.target.value ? Number(e.target.value) : null)
                        }
                      >
                        <option value="">None</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="booking-price-summary mt-auto">
                      <h6 className="booking-price-summary__title">Price summary</h6>
                      {priceGroups.length === 0 ? (
                        <p className="booking-price-summary__empty text-muted small mb-0">
                          Selected fields with prices will appear here.
                        </p>
                      ) : (
                        <div className="booking-price-summary__groups">
                          {priceGroups.map((group) => (
                            <div
                              key={group.groupName}
                              className="booking-price-summary__group"
                            >
                              <h6 className="booking-price-summary__group-title">
                                {group.groupName}
                              </h6>
                              <ul className="booking-price-summary__list list-unstyled mb-0">
                                {group.lines.map((line, i) => (
                                  <li
                                    key={`${group.groupName}-${line.label}-${i}`}
                                    className="booking-price-summary__row"
                                  >
                                    <span className="booking-price-summary__label">
                                      {line.label}
                                    </span>
                                    <span className="booking-price-summary__amount">
                                      {formatCurrency(line.amount, currencyOptions)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {priceGroups.length > 1 && (
                                <div className="booking-price-summary__group-total">
                                  <span>Subtotal</span>
                                  <span>
                                    {formatCurrency(group.subtotal, currencyOptions)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="booking-price-summary__total">
                        <span>Total</span>
                        <span>{formatCurrency(priceTotal, currencyOptions)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showAddGroupModal && (
        <>
          <div
            className="booking-group-modal-backdrop"
            aria-hidden="true"
            onClick={closeAddGroupModal}
          />
          <div
            className="booking-group-modal modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bookingAddGroupTitle"
          >
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 id="bookingAddGroupTitle" className="modal-title fs-6">
                    Add {groupLabel}
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeAddGroupModal}
                  />
                </div>
                <div className="modal-body">
                  <label htmlFor="booking-new-group-name" className="form-label">
                    {groupLabel} name
                  </label>
                  <input
                    id="booking-new-group-name"
                    type="text"
                    className={`form-control${addGroupError ? ' is-invalid' : ''}`}
                    value={newGroupInput}
                    onChange={(e) => {
                      setNewGroupInput(e.target.value)
                      setAddGroupError(null)
                    }}
                    autoFocus
                  />
                  {addGroupError && (
                    <div className="invalid-feedback d-block">{addGroupError}</div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={closeAddGroupModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddGroupSave}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default BookingEditModal
