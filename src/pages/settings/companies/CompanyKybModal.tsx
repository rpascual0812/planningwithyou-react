import { useCallback, useEffect, useState } from 'react'
import {
  fetchCompanyKyb,
  updateCompanyKyb,
  type CompanyKybRecord,
  type KybBusinessType,
} from '../../../services/companyKyb'
import { uploadDocument } from '../../../services/documents'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

type Props = {
  companyId: number
  companyName: string
  onClose: () => void
  onSaved: () => void
}

type KybFormState = {
  business_type: KybBusinessType
  government_id_file: string
  dti_registration_file: string
  sole_prop_business_address: string
  sole_prop_mobile_number: string
  bank_account_same_name: string
  sec_registration_file: string
  articles_of_incorporation_file: string
  bir_registration_file: string
  owner_director_id_files: { label: string; file: string }[]
  business_website_social: string
  company_email_domain: string
  proof_of_address_file: string
  business_description: string
}

const EMPTY_FORM: KybFormState = {
  business_type: '',
  government_id_file: '',
  dti_registration_file: '',
  sole_prop_business_address: '',
  sole_prop_mobile_number: '',
  bank_account_same_name: '',
  sec_registration_file: '',
  articles_of_incorporation_file: '',
  bir_registration_file: '',
  owner_director_id_files: [{ label: '', file: '' }],
  business_website_social: '',
  company_email_domain: '',
  proof_of_address_file: '',
  business_description: '',
}

function recordToForm(record: CompanyKybRecord): KybFormState {
  const ownerFiles = (record.owner_director_id_files ?? []).map((entry) => {
    if (typeof entry === 'string') {
      return { label: '', file: entry }
    }
    return {
      label: entry.label ?? '',
      file: entry.file ?? '',
    }
  })
  return {
    business_type: record.business_type ?? '',
    government_id_file: record.government_id_file ?? '',
    dti_registration_file: record.dti_registration_file ?? '',
    sole_prop_business_address: record.sole_prop_business_address ?? '',
    sole_prop_mobile_number: record.sole_prop_mobile_number ?? '',
    bank_account_same_name: record.bank_account_same_name ?? '',
    sec_registration_file: record.sec_registration_file ?? '',
    articles_of_incorporation_file: record.articles_of_incorporation_file ?? '',
    bir_registration_file: record.bir_registration_file ?? '',
    owner_director_id_files:
      ownerFiles.length > 0 ? ownerFiles : [{ label: '', file: '' }],
    business_website_social: record.business_website_social ?? '',
    company_email_domain: record.company_email_domain ?? '',
    proof_of_address_file: record.proof_of_address_file ?? '',
    business_description: record.business_description ?? '',
  }
}

function formToPayload(form: KybFormState) {
  return {
    business_type: form.business_type,
    government_id_file: form.government_id_file.trim(),
    dti_registration_file: form.dti_registration_file.trim(),
    sole_prop_business_address: form.sole_prop_business_address.trim(),
    sole_prop_mobile_number: form.sole_prop_mobile_number.trim(),
    bank_account_same_name: form.bank_account_same_name.trim(),
    sec_registration_file: form.sec_registration_file.trim(),
    articles_of_incorporation_file: form.articles_of_incorporation_file.trim(),
    bir_registration_file: form.bir_registration_file.trim(),
    owner_director_id_files: form.owner_director_id_files
      .filter((row) => row.file.trim())
      .map((row) => ({
        label: row.label.trim(),
        file: row.file.trim(),
      })),
    business_website_social: form.business_website_social.trim(),
    company_email_domain: form.company_email_domain.trim(),
    proof_of_address_file: form.proof_of_address_file.trim(),
    business_description: form.business_description.trim(),
  }
}

type KybFileFieldProps = {
  id: string
  label: string
  value: string
  disabled?: boolean
  onChange: (url: string) => void
}

const KybFileField = ({
  id,
  label,
  value,
  disabled,
  onChange,
}: KybFileFieldProps) => {
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return
    setUploading(true)
    try {
      const doc = await uploadDocument(file)
      onChange(doc.url || doc.file)
      showSuccessToast('File uploaded.')
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {value ? (
        <p className="small text-success mb-1">
          <i className="bi bi-check-circle me-1" />
          Document attached
        </p>
      ) : null}
      <input
        id={id}
        type="file"
        className="form-control form-control-sm"
        disabled={disabled || uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {uploading && <div className="form-text">Uploading…</div>}
    </div>
  )
}

const CompanyKybModal = ({ companyId, companyName, onClose, onSaved }: Props) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [record, setRecord] = useState<CompanyKybRecord | null>(null)
  const [form, setForm] = useState<KybFormState>(EMPTY_FORM)
  const [missingFields, setMissingFields] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setFormError(null)
    try {
      const data = await fetchCompanyKyb(companyId)
      setRecord(data)
      setForm(recordToForm(data))
      setMissingFields(data.missing_fields ?? [])
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to load KYB')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void load()
  }, [load])

  const readOnly =
    record?.status === 'submitted' || record?.status === 'approved'

  const patchForm = (patch: Partial<KybFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleSaveDraft = async () => {
    if (!form.business_type) {
      setFormError('Select a business type.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const data = await updateCompanyKyb(companyId, {
        ...formToPayload(form),
        ...(record?.status === 'rejected' ? { status: 'draft' } : {}),
      })
      setRecord(data)
      setMissingFields(data.missing_fields ?? [])
      showSuccessToast('KYB draft saved.')
      onSaved()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.business_type) {
      setFormError('Select a business type.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const data = await updateCompanyKyb(companyId, {
        ...formToPayload(form),
        status: 'submitted',
      })
      setRecord(data)
      setMissingFields([])
      showSuccessToast('KYB submitted for review.')
      onSaved()
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Submit failed'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted for review',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5">
                Know Your Business — {companyName}
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {loading ? (
                <p className="text-muted mb-0">Loading…</p>
              ) : (
                <>
                  {record && (
                    <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
                      <span className="text-muted small">Status:</span>
                      <span
                        className={`badge ${
                          record.status === 'approved'
                            ? 'text-bg-success'
                            : record.status === 'rejected'
                              ? 'text-bg-danger'
                              : record.status === 'submitted'
                                ? 'text-bg-warning'
                                : 'text-bg-secondary'
                        }`}
                      >
                        {statusLabel[record.status] ?? record.status}
                      </span>
                      {record.status === 'rejected' && record.rejection_notes ? (
                        <span className="small text-danger">
                          {record.rejection_notes}
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="mb-3">
                    <span className="form-label d-block">Business type</span>
                    <ul
                      className="settings-radio-list"
                      role="radiogroup"
                      aria-label="Business type"
                    >
                      <li>
                        <label className="settings-radio">
                          <input
                            type="radio"
                            name="kyb-business-type"
                            value="sole_proprietor"
                            checked={form.business_type === 'sole_proprietor'}
                            disabled={readOnly}
                            onChange={() =>
                              patchForm({ business_type: 'sole_proprietor' })
                            }
                          />
                          <span>Sole proprietorship</span>
                        </label>
                      </li>
                      <li>
                        <label className="settings-radio">
                          <input
                            type="radio"
                            name="kyb-business-type"
                            value="corporation"
                            checked={form.business_type === 'corporation'}
                            disabled={readOnly}
                            onChange={() =>
                              patchForm({ business_type: 'corporation' })
                            }
                          />
                          <span>Corporation</span>
                        </label>
                      </li>
                    </ul>
                  </div>

                  {form.business_type === 'sole_proprietor' && (
                    <fieldset className="mb-3">
                      <legend className="fs-6 fw-semibold">Sole proprietorship</legend>
                      <KybFileField
                        id="kyb-government-id"
                        label="Valid government ID"
                        value={form.government_id_file}
                        disabled={readOnly}
                        onChange={(url) => patchForm({ government_id_file: url })}
                      />
                      <KybFileField
                        id="kyb-dti"
                        label="DTI registration"
                        value={form.dti_registration_file}
                        disabled={readOnly}
                        onChange={(url) => patchForm({ dti_registration_file: url })}
                      />
                      <div className="mb-3">
                        <label className="form-label" htmlFor="kyb-sp-address">
                          Business address
                        </label>
                        <textarea
                          id="kyb-sp-address"
                          className="form-control"
                          rows={2}
                          disabled={readOnly}
                          value={form.sole_prop_business_address}
                          onChange={(e) =>
                            patchForm({ sole_prop_business_address: e.target.value })
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="kyb-sp-mobile">
                          Mobile number
                        </label>
                        <input
                          id="kyb-sp-mobile"
                          type="tel"
                          className="form-control"
                          disabled={readOnly}
                          value={form.sole_prop_mobile_number}
                          onChange={(e) =>
                            patchForm({ sole_prop_mobile_number: e.target.value })
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="kyb-bank">
                          Bank account under same name
                        </label>
                        <textarea
                          id="kyb-bank"
                          className="form-control"
                          rows={2}
                          disabled={readOnly}
                          value={form.bank_account_same_name}
                          onChange={(e) =>
                            patchForm({ bank_account_same_name: e.target.value })
                          }
                        />
                      </div>
                    </fieldset>
                  )}

                  {form.business_type === 'corporation' && (
                    <fieldset className="mb-3">
                      <legend className="fs-6 fw-semibold">Corporation</legend>
                      <KybFileField
                        id="kyb-sec"
                        label="SEC registration"
                        value={form.sec_registration_file}
                        disabled={readOnly}
                        onChange={(url) => patchForm({ sec_registration_file: url })}
                      />
                      <KybFileField
                        id="kyb-articles"
                        label="Articles of Incorporation"
                        value={form.articles_of_incorporation_file}
                        disabled={readOnly}
                        onChange={(url) =>
                          patchForm({ articles_of_incorporation_file: url })
                        }
                      />
                      <KybFileField
                        id="kyb-bir"
                        label="BIR registration"
                        value={form.bir_registration_file}
                        disabled={readOnly}
                        onChange={(url) => patchForm({ bir_registration_file: url })}
                      />
                      <div className="mb-3">
                        <span className="form-label d-block">
                          Valid IDs of owners/directors
                        </span>
                        {form.owner_director_id_files.map((row, index) => (
                          <div
                            key={index}
                            className="border rounded p-2 mb-2 bg-light"
                          >
                            <div className="mb-2">
                              <label
                                className="form-label small"
                                htmlFor={`kyb-owner-label-${index}`}
                              >
                                Name / role (optional)
                              </label>
                              <input
                                id={`kyb-owner-label-${index}`}
                                type="text"
                                className="form-control form-control-sm"
                                disabled={readOnly}
                                value={row.label}
                                onChange={(e) => {
                                  const next = [...form.owner_director_id_files]
                                  next[index] = {
                                    ...next[index],
                                    label: e.target.value,
                                  }
                                  patchForm({ owner_director_id_files: next })
                                }}
                              />
                            </div>
                            <KybFileField
                              id={`kyb-owner-file-${index}`}
                              label="ID document"
                              value={row.file}
                              disabled={readOnly}
                              onChange={(url) => {
                                const next = [...form.owner_director_id_files]
                                next[index] = { ...next[index], file: url }
                                patchForm({ owner_director_id_files: next })
                              }}
                            />
                          </div>
                        ))}
                        {!readOnly && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() =>
                              patchForm({
                                owner_director_id_files: [
                                  ...form.owner_director_id_files,
                                  { label: '', file: '' },
                                ],
                              })
                            }
                          >
                            <i className="bi bi-plus-lg me-1" />
                            Add owner/director ID
                          </button>
                        )}
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="kyb-website-social">
                          Business website / social pages
                        </label>
                        <textarea
                          id="kyb-website-social"
                          className="form-control"
                          rows={2}
                          disabled={readOnly}
                          value={form.business_website_social}
                          onChange={(e) =>
                            patchForm({ business_website_social: e.target.value })
                          }
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="kyb-email-domain">
                          Company email domain
                        </label>
                        <input
                          id="kyb-email-domain"
                          type="text"
                          className="form-control"
                          placeholder="example.com"
                          disabled={readOnly}
                          value={form.company_email_domain}
                          onChange={(e) =>
                            patchForm({ company_email_domain: e.target.value })
                          }
                        />
                      </div>
                    </fieldset>
                  )}

                  {form.business_type && (
                    <fieldset>
                      <legend className="fs-6 fw-semibold">Additional checks</legend>
                      <KybFileField
                        id="kyb-proof-address"
                        label="Proof of address"
                        value={form.proof_of_address_file}
                        disabled={readOnly}
                        onChange={(url) => patchForm({ proof_of_address_file: url })}
                      />
                      <div className="mb-3">
                        <label className="form-label" htmlFor="kyb-description">
                          Business description
                        </label>
                        <textarea
                          id="kyb-description"
                          className="form-control"
                          rows={3}
                          disabled={readOnly}
                          value={form.business_description}
                          onChange={(e) =>
                            patchForm({ business_description: e.target.value })
                          }
                        />
                      </div>
                    </fieldset>
                  )}

                  {!readOnly && missingFields.length > 0 && (
                    <div className="alert alert-warning py-2 small mb-0">
                      <strong>Still required:</strong> {missingFields.join(', ')}
                    </div>
                  )}

                  {formError && (
                    <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                      {formError}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving || submitting}
              >
                {readOnly ? 'Close' : 'Cancel'}
              </button>
              {!readOnly && !loading && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => void handleSaveDraft()}
                    disabled={saving || submitting}
                  >
                    {saving ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSubmit()}
                    disabled={saving || submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit for review'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default CompanyKybModal
