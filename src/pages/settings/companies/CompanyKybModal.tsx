import { useCallback, useEffect, useState } from 'react'
import {
  fetchCompanyKyb,
  startPaymongoKybOnboarding,
  updateCompanyKyb,
  KYB_BUSINESS_TYPE_OPTIONS,
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
}

function recordToForm(record: CompanyKybRecord, companyName: string): KybFormState {
  return {
    business_type: record.business_type ?? '',
    merchant_business_name: record.merchant_business_name || companyName,
    merchant_email: record.merchant_email ?? '',
    merchant_mobile_number: record.merchant_mobile_number ?? '',
  }
}

function formToPayload(form: KybFormState) {
  return {
    business_type: form.business_type,
    merchant_business_name: form.merchant_business_name.trim(),
    merchant_email: form.merchant_email.trim(),
    merchant_mobile_number: form.merchant_mobile_number.trim(),
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
      } as CompanyKybRecord,
      companyName,
    ),
  )
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [activeOnboardingUrl, setActiveOnboardingUrl] = useState('')

  const openOnboardingUrl = (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) {
      const message =
        'PayMongo did not return an onboarding link. Please try again or contact support.'
      setFormError(message)
      showErrorToast(message)
      return
    }
    window.open(trimmed, '_blank', 'noopener,noreferrer')
  }

  const load = useCallback(async () => {
    setLoading(true)
    setFormError(null)
    try {
      const data = await fetchCompanyKyb(companyId)
      setRecord(data)
      setActiveOnboardingUrl((data.onboarding_url ?? '').trim())
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
  const continueToPayMongoDisabled =
    saving ||
    redirecting ||
    loading ||
    (Boolean(activeOnboardingUrl) && record?.status === 'pending_paymongo')
  const showSaveDraft =
    !readOnly &&
    (!activeOnboardingUrl || record?.status === 'rejected')

  const patchForm = (patch: Partial<KybFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const visibleMissingFields = missingFields.filter((field) => {
    if (field === 'Business type' && form.business_type) return false
    if (field === 'Business name' && form.merchant_business_name.trim()) return false
    if (field === 'Business email' && form.merchant_email.trim()) return false
    if (field === 'Mobile number' && form.merchant_mobile_number.trim()) return false
    return true
  })

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

  const handleContinueToPayMongo = async () => {
    if (!form.business_type) {
      setFormError('Select a business type.')
      return
    }
    setRedirecting(true)
    setFormError(null)
    try {
      const data = await startPaymongoKybOnboarding(companyId, {
        ...formToPayload(form),
      })
      setRecord(data)
      const url = (data.onboarding_url ?? '').trim()
      setActiveOnboardingUrl(url)
      onSaved()
      openOnboardingUrl(url)
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
                    We do not collect your documents inside Planning With You.
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

                  {activeOnboardingUrl && record?.status === 'pending_paymongo' && (
                    <div className="alert alert-info py-2 small">
                      Verification is in progress on PayMongo.{' '}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => openOnboardingUrl(activeOnboardingUrl)}
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
                      {KYB_BUSINESS_TYPE_OPTIONS.map((opt) => (
                        <li key={opt.value}>
                          <label className="settings-radio">
                            <input
                              type="radio"
                              name="kyb-business-type"
                              value={opt.value}
                              checked={form.business_type === opt.value}
                              disabled={readOnly}
                              onChange={() =>
                                patchForm({
                                  business_type: opt.value as KybBusinessType,
                                })
                              }
                            />
                            <span>{opt.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="kyb-business-name">
                        Business legal name (as per BIR) *
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
                  </div>

                  {visibleMissingFields.length > 0 && (
                    <div className="alert alert-warning py-2 mt-3 mb-0 small">
                      Missing: {visibleMissingFields.join(', ')}
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
                  {showSaveDraft && (
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => void handleSaveDraft()}
                      disabled={saving || redirecting || loading}
                    >
                      {saving ? 'Saving…' : 'Save draft'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleContinueToPayMongo()}
                    disabled={continueToPayMongoDisabled}
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
