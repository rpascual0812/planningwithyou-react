import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
  type ContactRecord,
  type ContactPayload,
  type PhoneNumber,
  type Address,
} from '../services/contacts'
import { fetchActiveCompanies, type CompanyRecord } from '../services/companies'
import { fetchMe } from '../services/users'

const EDIT_PARAM = 'edit'

const AVATAR_COLORS = [
  '#9c6cd0', '#6b7785', '#52b585', '#5a8edb',
  '#f0a830', '#d65a5a', '#3e8c84', '#c66bbd',
]

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function initials(first: string, last: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  return '??'
}

function displayName(c: ContactRecord): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || `Contact #${c.id}`
}

const EMPTY_PHONE: PhoneNumber = { number: '', label: 'mobile', is_default: true }
const EMPTY_ADDRESS: Address = {
  label: 'home',
  street: '',
  city: '',
  state: '',
  zip_code: '',
  country: '',
  is_default: true,
}

function ensureSingleDefault<T extends { is_default: boolean }>(items: T[]): T[] {
  if (items.length === 0) return items
  const chosen = items.findIndex((item) => item.is_default)
  const index = chosen >= 0 ? chosen : 0
  return items.map((item, i) => ({ ...item, is_default: i === index }))
}

/** Keep the form's chosen default when empty phone rows are omitted on save. */
function buildPhoneNumbersForSave(phones: PhoneNumber[]): PhoneNumber[] {
  const defaultFormIndex = phones.findIndex((p) => p.is_default)
  const saved: { formIndex: number; phone: PhoneNumber }[] = []

  for (let formIndex = 0; formIndex < phones.length; formIndex += 1) {
    const phone = phones[formIndex]
    if (!phone.number.trim()) continue

    const parsed = parsePhoneNumberFromString(phone.number, 'PH')
    if (!parsed?.isValid()) continue

    saved.push({
      formIndex,
      phone: {
        ...phone,
        number: parsed.formatInternational(),
        is_default: false,
      },
    })
  }

  if (saved.length === 0) return []

  const defaultSavedIndex = saved.findIndex((row) => row.formIndex === defaultFormIndex)
  const chosen = defaultSavedIndex >= 0 ? defaultSavedIndex : 0

  return saved.map((row, i) => ({
    ...row.phone,
    is_default: i === chosen,
  }))
}

const DEFAULT_PHONE_NUMBERS: PhoneNumber[] = [{ ...EMPTY_PHONE }]
const DEFAULT_ADDRESSES: Address[] = [{ ...EMPTY_ADDRESS }]

const EMPTY_FORM: ContactPayload = {
  first_name: '',
  last_name: '',
  email: '',
  company: '',
  company_id: null,
  notes: '',
  phone_numbers: DEFAULT_PHONE_NUMBERS.map((p) => ({ ...p })),
  addresses: DEFAULT_ADDRESSES.map((a) => ({ ...a })),
}

function formFromContact(c: ContactRecord): ContactPayload {
  return {
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    company: c.company,
    company_id: c.company_id,
    notes: c.notes,
    phone_numbers: ensureSingleDefault(
      c.phone_numbers.length > 0
        ? c.phone_numbers.map((p) => ({
            number: p.number,
            label: p.label,
            is_default: !!p.is_default,
          }))
        : DEFAULT_PHONE_NUMBERS.map((p) => ({ ...p })),
    ),
    addresses: ensureSingleDefault(
      c.addresses.length > 0
        ? c.addresses.map((a) => ({
            label: a.label,
            street: a.street,
            city: a.city,
            state: a.state,
            zip_code: a.zip_code,
            country: a.country,
            is_default: !!a.is_default,
          }))
        : DEFAULT_ADDRESSES.map((a) => ({ ...a })),
    ),
  }
}

const PHONE_LABELS: PhoneNumber['label'][] = ['mobile', 'home', 'work', 'other']
const ADDRESS_LABELS: Address['label'][] = ['home', 'work', 'other']

const ContactsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null)
  const [form, setForm] = useState<ContactPayload>({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ContactRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [userCompanyId, setUserCompanyId] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchMe()
      .then((user) => setUserCompanyId(user.company))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!modalOpen || editingContact != null || userCompanyId == null) return
    setForm((prev) =>
      prev.company_id == null ? { ...prev, company_id: userCompanyId } : prev,
    )
  }, [modalOpen, editingContact, userCompanyId])

  const writeEditParam = (id: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set(EDIT_PARAM, String(id))
      return next
    }, { replace: true })
  }

  const clearEditParam = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(EDIT_PARAM)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const loadContacts = useCallback(async (q = '') => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchContacts(q)
      setContacts(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContacts(debouncedSearch)
  }, [debouncedSearch, loadContacts])

  // Keep modal in sync with URL param
  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId) return
    const contact = contacts.find((c) => String(c.id) === targetId)
    if (!contact) {
      if (!loading) clearEditParam()
      return
    }
    if (editingContact && editingContact.id === contact.id
      && editingContact.updated_at === contact.updated_at) return
    setEditingContact(contact)
    setForm(formFromContact(contact))
    setFormError(null)
    setModalOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, contacts, loading])

  const openAdd = () => {
    clearEditParam()
    setEditingContact(null)
    setForm({
      ...EMPTY_FORM,
      company_id: userCompanyId,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (c: ContactRecord) => writeEditParam(c.id)

  const closeModal = () => {
    clearEditParam()
    setModalOpen(false)
    setEditingContact(null)
    setFormError(null)
  }

  const handleSave = async () => {
    setFormError(null)

    const invalid: string[] = []
    for (const phone of form.phone_numbers) {
      if (!phone.number.trim()) continue
      const parsed = parsePhoneNumberFromString(phone.number, 'PH')
      if (!parsed?.isValid()) {
        invalid.push(phone.number)
      }
    }
    if (invalid.length) {
      setFormError(
        `Invalid phone number${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}. ` +
        'Please use a valid format (e.g. +63 912 345 6789).',
      )
      return
    }

    if (form.company_id == null) {
      setFormError('Company is required.')
      return
    }

    const payload = {
      ...form,
      company_id: form.company_id,
      phone_numbers: buildPhoneNumbersForSave(form.phone_numbers),
      addresses: ensureSingleDefault(form.addresses.map((a) => ({ ...a }))),
    }

    setSaving(true)
    try {
      if (editingContact) {
        await updateContact(editingContact.id, payload)
        await loadContacts(debouncedSearch)
      } else {
        const created = await createContact(payload)
        await loadContacts(debouncedSearch)
        writeEditParam(created.id)
      }
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
      await deleteContact(deleteTarget.id)
      setDeleteTarget(null)
      await loadContacts(debouncedSearch)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!modalOpen && !deleteTarget) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null)
        else closeModal()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, deleteTarget])

  const setField = <K extends keyof ContactPayload>(key: K, val: ContactPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="users-table-card">
          <div className="users-table-toolbar">
            <div className="users-search">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                className="users-search-input"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search contacts"
              />
              {search && (
                <button
                  type="button"
                  className="users-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
            <div className="users-toolbar-right">
              <span className="users-search-count">
                {contacts.length} contact{contacts.length !== 1 && 's'}
              </span>
              <button type="button" className="btn users-btn-add" onClick={openAdd}>
                <i className="bi bi-plus-lg" /> Add Contact
              </button>
            </div>
          </div>

          <div className="users-table-scroll">
            {loading && contacts.length === 0 ? (
              <div className="users-table-empty-wrap">
                <span className="users-table-empty">Loading contacts...</span>
              </div>
            ) : error ? (
              <div className="users-table-empty-wrap">
                <span className="users-table-empty users-table-error">{error}</span>
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Phone</th>
                    <th>Created</th>
                    <th className="users-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="users-table-row">
                      <td className="users-table-id">{c.id}</td>
                      <td>
                        <div className="users-table-person">
                          <span
                            className="users-table-avatar"
                            style={{ backgroundColor: avatarColor(c.id) }}
                            aria-hidden="true"
                          >
                            {initials(c.first_name, c.last_name)}
                          </span>
                          <span className="users-table-name">{displayName(c)}</span>
                        </div>
                      </td>
                      <td className="users-table-contact">{c.email || '—'}</td>
                      <td className="users-table-position">{c.company_name || '—'}</td>
                      <td className="users-table-contact">
                        {c.phone_numbers.length
                          ? c.phone_numbers[0].number
                          : '—'}
                        {c.phone_numbers.length > 1 && (
                          <span className="text-muted small ms-1">
                            (+{c.phone_numbers.length - 1})
                          </span>
                        )}
                      </td>
                      <td className="users-table-office">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="users-actions">
                          <button
                            type="button"
                            className="users-action-btn users-action-edit"
                            title="Edit contact"
                            onClick={() => openEdit(c)}
                          >
                            <i className="bi bi-pencil-square" />
                          </button>
                          <button
                            type="button"
                            className="users-action-btn users-action-delete"
                            title="Delete contact"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="users-table-empty">
                        {search
                          ? `No contacts found for "${search}".`
                          : 'No contacts yet. Click "Add Contact" to create one.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <ContactFormModal
          editing={editingContact}
          form={form}
          setField={setField}
          error={formError}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          contact={deleteTarget}
          deleting={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Contact form modal                                                 */
/* ------------------------------------------------------------------ */

function validatePhone(value: string): boolean {
  if (!value.trim()) return true
  const parsed = parsePhoneNumberFromString(value, 'PH')
  return !!parsed && parsed.isValid()
}

type ContactFormModalProps = {
  editing: ContactRecord | null
  form: ContactPayload
  setField: <K extends keyof ContactPayload>(key: K, val: ContactPayload[K]) => void
  error: string | null
  saving: boolean
  onSave: () => void
  onClose: () => void
}

const ContactFormModal = ({
  editing,
  form,
  setField,
  error,
  saving,
  onSave,
  onClose,
}: ContactFormModalProps) => {
  const title = editing ? 'Edit Contact' : 'Add Contact'
  const [phoneErrors, setPhoneErrors] = useState<Record<number, boolean>>({})
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setCompaniesLoading(true)
    void fetchActiveCompanies()
      .then((data) => {
        if (!cancelled) setCompanies(data)
      })
      .catch(() => {
        if (!cancelled) setCompanies([])
      })
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const markPhoneValidity = (idx: number, value: string) => {
    const valid = validatePhone(value)
    setPhoneErrors((prev) => {
      const next = { ...prev }
      if (valid) delete next[idx]
      else next[idx] = true
      return next
    })
  }

  const addPhone = () =>
    setField('phone_numbers', [
      ...form.phone_numbers,
      { ...EMPTY_PHONE, is_default: false },
    ])

  const setDefaultPhone = (idx: number) => {
    setField(
      'phone_numbers',
      form.phone_numbers.map((p, i) => ({ ...p, is_default: i === idx })),
    )
  }

  const updatePhone = (idx: number, patch: Partial<PhoneNumber>) =>
    setField(
      'phone_numbers',
      form.phone_numbers.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    )

  const removePhone = (idx: number) => {
    if (form.phone_numbers.length <= 1) {
      setField('phone_numbers', [{ ...EMPTY_PHONE, is_default: true }])
      return
    }
    const next = form.phone_numbers.filter((_, i) => i !== idx)
    setField('phone_numbers', ensureSingleDefault(next))
  }

  const addAddress = () =>
    setField('addresses', [
      ...form.addresses,
      { ...EMPTY_ADDRESS, is_default: false },
    ])

  const setDefaultAddress = (idx: number) => {
    setField(
      'addresses',
      form.addresses.map((a, i) => ({ ...a, is_default: i === idx })),
    )
  }

  const updateAddress = (idx: number, patch: Partial<Address>) =>
    setField(
      'addresses',
      form.addresses.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    )

  const removeAddress = (idx: number) => {
    if (form.addresses.length <= 1) {
      setField('addresses', [{ ...EMPTY_ADDRESS, is_default: true }])
      return
    }
    const next = form.addresses.filter((_, i) => i !== idx)
    setField('addresses', ensureSingleDefault(next))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave()
  }

  return (
    <>
      <div className="user-details-modal-backdrop modal-backdrop fade show" onClick={onClose} />
      <div
        className="user-details-modal modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contactFormTitle"
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="contactFormTitle" className="modal-title fs-5">{title}</h1>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger py-2" role="alert">{error}</div>
                )}

                <div className="mb-3">
                  <label className="form-label" htmlFor="contact-company-id">
                    Company *
                  </label>
                  <select
                    id="contact-company-id"
                    className="form-select"
                    value={form.company_id ?? ''}
                    required
                    disabled={companiesLoading || companies.length === 0}
                    onChange={(e) => {
                      const id = Number(e.target.value)
                      setField(
                        'company_id',
                        Number.isFinite(id) && id > 0 ? id : null,
                      )
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

                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label">First Name *</label>
                    <input
                      className="form-control"
                      value={form.first_name}
                      onChange={(e) => setField('first_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Last Name</label>
                    <input
                      className="form-control"
                      value={form.last_name}
                      onChange={(e) => setField('last_name', e.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Organization</label>
                    <input
                      className="form-control"
                      value={form.company}
                      onChange={(e) => setField('company', e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Notes</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setField('notes', e.target.value)}
                    />
                  </div>
                </div>

                {/* Phone Numbers */}
                <div className="mt-4">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <h6 className="mb-0">Phone Numbers</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={addPhone}
                    >
                      <i className="bi bi-plus-lg me-1" />Add
                    </button>
                  </div>
                  {form.phone_numbers.map((phone, idx) => (
                    <div key={idx} className="mb-2">
                      <div className="row g-2 align-items-end">
                      <div className="col">
                        <input
                          className={`form-control form-control-sm ${phoneErrors[idx] ? 'is-invalid' : ''}`}
                          placeholder="Phone number (e.g. +63 912 345 6789)"
                          value={phone.number}
                          onChange={(e) => {
                            updatePhone(idx, { number: e.target.value })
                            if (phoneErrors[idx]) markPhoneValidity(idx, e.target.value)
                          }}
                          onBlur={() => markPhoneValidity(idx, phone.number)}
                        />
                      </div>
                      <div className="col-auto">
                        <select
                          className="form-select form-select-sm"
                          value={phone.label}
                          onChange={(e) =>
                            updatePhone(idx, { label: e.target.value as PhoneNumber['label'] })
                          }
                        >
                          {PHONE_LABELS.map((l) => (
                            <option key={l} value={l}>
                              {l.charAt(0).toUpperCase() + l.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-auto">
                        <div className="form-check mb-0">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="contact-phone-default"
                            id={`phone-default-${idx}`}
                            checked={phone.is_default}
                            onChange={() => setDefaultPhone(idx)}
                          />
                          <label
                            className="form-check-label small"
                            htmlFor={`phone-default-${idx}`}
                          >
                            Default
                          </label>
                        </div>
                      </div>
                      <div className="col-auto">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removePhone(idx)}
                          title={form.phone_numbers.length <= 1 ? 'Clear' : 'Remove'}
                          aria-label={form.phone_numbers.length <= 1 ? 'Clear phone number' : 'Remove phone number'}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                      </div>
                      {phoneErrors[idx] && (
                        <div className="text-danger small mt-1">
                          <i className="bi bi-exclamation-circle me-1" />
                          Invalid phone number. Use a format like +63 912 345 6789.
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Addresses */}
                <div className="mt-4">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <h6 className="mb-0">Addresses</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={addAddress}
                    >
                      <i className="bi bi-plus-lg me-1" />Add
                    </button>
                  </div>
                  {form.addresses.map((addr, idx) => (
                    <div key={idx} className="card card-body p-2 mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                        <div className="d-flex align-items-center gap-2">
                          <select
                            className="form-select form-select-sm"
                            style={{ width: 'auto' }}
                            value={addr.label}
                            onChange={(e) =>
                              updateAddress(idx, { label: e.target.value as Address['label'] })
                            }
                          >
                            {ADDRESS_LABELS.map((l) => (
                              <option key={l} value={l}>
                                {l.charAt(0).toUpperCase() + l.slice(1)}
                              </option>
                            ))}
                          </select>
                          <div className="form-check mb-0">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="contact-address-default"
                              id={`address-default-${idx}`}
                              checked={addr.is_default}
                              onChange={() => setDefaultAddress(idx)}
                            />
                            <label
                              className="form-check-label small"
                              htmlFor={`address-default-${idx}`}
                            >
                              Default
                            </label>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removeAddress(idx)}
                          title={form.addresses.length <= 1 ? 'Clear' : 'Remove'}
                          aria-label={form.addresses.length <= 1 ? 'Clear address' : 'Remove address'}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                      <div className="row g-2">
                        <div className="col-12">
                          <input
                            className="form-control form-control-sm"
                            placeholder="Street"
                            value={addr.street}
                            onChange={(e) => updateAddress(idx, { street: e.target.value })}
                          />
                        </div>
                        <div className="col-sm-6">
                          <input
                            className="form-control form-control-sm"
                            placeholder="City"
                            value={addr.city}
                            onChange={(e) => updateAddress(idx, { city: e.target.value })}
                          />
                        </div>
                        <div className="col-sm-6">
                          <input
                            className="form-control form-control-sm"
                            placeholder="State / Province"
                            value={addr.state}
                            onChange={(e) => updateAddress(idx, { state: e.target.value })}
                          />
                        </div>
                        <div className="col-sm-6">
                          <input
                            className="form-control form-control-sm"
                            placeholder="ZIP / Postal code"
                            value={addr.zip_code}
                            onChange={(e) => updateAddress(idx, { zip_code: e.target.value })}
                          />
                        </div>
                        <div className="col-sm-6">
                          <input
                            className="form-control form-control-sm"
                            placeholder="Country"
                            value={addr.country}
                            onChange={(e) => updateAddress(idx, { country: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn users-btn-save" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Delete confirmation modal                                          */
/* ------------------------------------------------------------------ */

type DeleteConfirmModalProps = {
  contact: ContactRecord
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}

const DeleteConfirmModal = ({
  contact,
  deleting,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) => (
  <>
    <div className="user-details-modal-backdrop modal-backdrop fade show" onClick={onClose} />
    <div
      className="user-details-modal modal fade show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleteContactTitle"
    >
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header">
            <h1 id="deleteContactTitle" className="modal-title fs-5">Delete Contact</h1>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <p className="mb-0">
              Are you sure you want to delete{' '}
              <strong>{displayName(contact)}</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
)

export default ContactsPage
