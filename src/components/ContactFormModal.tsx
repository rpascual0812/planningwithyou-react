import { useEffect, useState } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { fetchActiveCompanies, type CompanyRecord } from '../services/companies'
import type { ContactPayload, ContactRecord, PhoneNumber, Address } from '../services/contacts'
import { EMPTY_ADDRESS, EMPTY_PHONE, ensureSingleDefault } from '../lib/contactForm'

const PHONE_LABELS: PhoneNumber['label'][] = ['mobile', 'home', 'work', 'other']
const ADDRESS_LABELS: Address['label'][] = ['home', 'work', 'other']

function validatePhoneField(value: string): boolean {
  if (!value.trim()) return true
  const parsed = parsePhoneNumberFromString(value, 'PH')
  return !!parsed && parsed.isValid()
}

export type ContactFormModalProps = {
  editing: ContactRecord | null
  form: ContactPayload
  setField: <K extends keyof ContactPayload>(key: K, val: ContactPayload[K]) => void
  error: string | null
  saving: boolean
  onSave: () => void
  onClose: () => void
  /** Render above the booking modal when opened from Add/Edit booking. */
  elevated?: boolean
}

export default function ContactFormModal({
  editing,
  form,
  setField,
  error,
  saving,
  onSave,
  onClose,
  elevated = false,
}: ContactFormModalProps) {
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
    const valid = validatePhoneField(value)
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
      <div className={`user-details-modal-backdrop modal-backdrop fade show${elevated ? " contact-form-modal-elevated" : ""}`} onClick={onClose} />
      <div
        className={`user-details-modal modal fade show d-block${elevated ? " contact-form-modal-elevated" : ""}`}
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

