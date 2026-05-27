import { useCallback, useEffect, useState } from 'react'
import {
  fetchCompanyKyb,
  startPaymongoKybOnboarding,
  updateCompanyKyb,
  type CompanyKybRecord,
  type KybBusinessType,
} from '../../../services/companyKyb'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

type Props = {
  companyId: number
  companyName: string
  onClose: () => void
  onSaved: () => void
  stacked?: boolean
}

type KybFormState = {
  business_type: KybBusinessType
  merchant_business_name: string
  merchant_email: string
  merchant_mobile_number: string
  business_website: string
  bank_name: string
  bank_account_name: string
  bank_account_number: string
}

function recordToForm(record: CompanyKybRecord, companyName: string): KybFormState {
  const bank = record.bank_details ?? {}
  return {
    business_type: record.business_type ?? '',
    merchant_business_name: record.merchant_business_name || companyName,
    merchant_email: record.merchant_email ?? '',
    merchant_mobile_number: record.merchant_mobile_number ?? '',
    business_website: record.business_website ?? '',
    bank_name: bank.bank_name ?? '',
    bank_account_name: bank.account_name ?? '',
    bank_account_number: bank.account_number ?? '',
  }
}

function formToPayload(form: KybFormState) {
  return {
    business_type: form.business_type,
    merchant_business_name: form.merchant_business_name.trim(),
    merchant_email: form.merchant_email.trim(),
    merchant_mobile_number: form.merchant_mobile_number.trim(),
    business_website: form.business_website.trim(),
    bank_details: {
      bank_name: form.bank_name.trim(),
      account_name: form.bank_account_name.trim(),
      account_number: form.bank_account_number.trim(),
    },
  }
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_paymongo: 'Pending PayMongo verification',
  approved: 'Verified',
  rejected: 'Rejected',
}

const CompanyKybModal = ({
  companyId,
  companyName,
  onClose,
  onSaved,
  stacked = false,
}: Props) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [record, setRecord] = useState<CompanyKybRecord | null>(null)
  const [form, setForm] = useState<KybFormState>(() =>
    recordToForm(
      {
        business_type: '',
        merchant_business_name: companyName,
        merchant_email: '',
        merchant_mobile_number: '',
        business_website: '',
        bank_details: {},
      } as CompanyKybRecord,
      companyName,
    ),
  )
  const [missingFields, setMissingFields] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setFormError(null)
    try {
      const data = await fetchCompanyKyb(companyId)
      setRecord(data)
      setForm(recordToForm(data, companyName))
      setMissingFields(data.missing_fields ?? [])
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to load verification')
    } finally {
      setLoading(false)
    }
  }, [companyId, companyName])

  useEffect(() => {
    void load()
  }, [load])

  const readOnly = record?.status === 'approved'

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
      showSuccessToast('Application saved.')
      onSaved()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const handleContinueToPayMongo = async (regenerate = false) => {
    if (!form.business_type) {
      setFormError('Select a business type.')
      return
    }
    setRedirecting(true)
    setFormError(null)
    try {
      const data = await startPaymongoKybOnboarding(companyId, {
        ...formToPayload(form),
        regenerate_link: regenerate,
      })
      setRecord(data)
      onSaved()
      const url = data.onboarding_url?.trim()
      if (!url) {
        showSuccessToast(
          'PayMongo onboarding started. Refresh status after completing verification on PayMongo.',
        )
        return
      }
      window.location.assign(url)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to start PayMongo verification'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setRedirecting(false)
    }
  }

  const layerClass = stacked ? ' company-kyb-modal--stacked' : ''
  const rejectionNote = record?.rejection_reason ?? record?.rejection_notes

  return (
    <>
      <div
        className={`modal-backdrop fade show${layerClass}`}
        onClick={onClose}
      />
      <div
        className={`modal fade show d-block${layerClass}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5">
                Business verification — {companyName}
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
                  <p className="text-muted small">
                    Collect your business details here, then continue to PayMongo to
                    upload documents and complete verification on their secure site.
                    We no longer collect KYB documents inside Planning With You.
                  </p>

                  {record && (
                    <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
                      <span className="text-muted small">Status:</span>
                      <span
                        className={`badge ${
                          record.status === 'approved'
                            ? 'text-bg-success'
                            : record.status === 'rejected'
                              ? 'text-bg-danger'
                              : record.status === 'pending_paymongo'
                                ? 'text-bg-warning'
                                : 'text-bg-secondary'
                        }`}
                      >
                        {STATUS_LABEL[record.status] ?? record.status}
                      </span>
                      {rejectionNote ? (
                        <span className="small text-danger">{rejectionNote}</span>
                      ) : null}
                    </div>
                  )}

                  {record?.onboarding_url && record.status === 'pending_paymongo' && (
                    <div className="alert alert-info py-2 small">
                      Verification is in progress on PayMongo.{' '}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => void handleContinueToPayMongo(true)}
                        disabled={redirecting}
                      >
                        Open onboarding again
                      </button>
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

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="kyb-business-name">
                        Business name *
                      </label>
                      <input
                        id="kyb-business-name"
                        type="text"
                        className="form-control"
                        value={form.merchant_business_name}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchForm({ merchant_business_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="kyb-email">
                        Business email *
                      </label>
                      <input
                        id="kyb-email"
                        type="email"
                        className="form-control"
                        value={form.merchant_email}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchForm({ merchant_email: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="kyb-mobile">
                        Mobile number *
                      </label>
                      <input
                        id="kyb-mobile"
                        type="tel"
                        className="form-control"
                        placeholder="+639171234567"
                        value={form.merchant_mobile_number}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchForm({ merchant_mobile_number: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="kyb-website">
                        Website (optional)
                      </label>
                      <input
                        id="kyb-website"
                        type="url"
                        className="form-control"
                        placeholder="https://"
                        value={form.business_website}
                        disabled={readOnly}
                        onChange={(e) =>
                          patchForm({ business_website: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <fieldset
                    className="border-0 p-0 mt-2"
                    disabled={readOnly}
                  >
                    <legend className="form-label fs-6">
                      Payout bank details (optional)
                    </legend>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="kyb-bank">
                          Bank
                        </label>
                        <input
                          id="kyb-bank"
                          type="text"
                          className="form-control"
                          value={form.bank_name}
                          onChange={(e) =>
                            patchForm({ bank_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="kyb-acct-name">
                          Account name
                        </label>
                        <input
                          id="kyb-acct-name"
                          type="text"
                          className="form-control"
                          value={form.bank_account_name}
                          onChange={(e) =>
                            patchForm({ bank_account_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="kyb-acct-num">
                          Account number
                        </label>
                        <input
                          id="kyb-acct-num"
                          type="text"
                          className="form-control"
                          value={form.bank_account_number}
                          onChange={(e) =>
                            patchForm({ bank_account_number: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </fieldset>

                  {missingFields.length > 0 && (
                    <div className="alert alert-warning py-2 mt-3 mb-0 small">
                      Missing: {missingFields.join(', ')}
                    </div>
                  )}

                  {formError && (
                    <div className="alert alert-danger py-2 mt-3 mb-0">
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
                disabled={saving || redirecting}
              >
                Close
              </button>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => void handleSaveDraft()}
                    disabled={saving || redirecting || loading}
                  >
                    {saving ? 'Saving…' : 'Save draft'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleContinueToPayMongo(false)}
                    disabled={saving || redirecting || loading}
                  >
                    {redirecting ? 'Redirecting…' : 'Continue to PayMongo'}
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
