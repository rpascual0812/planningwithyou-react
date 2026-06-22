import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCompanyKyb,
  startPaymongoKybOnboarding,
  startXenditKybOnboarding,
  updateCompanyKyb,
  KYB_BUSINESS_TYPE_OPTIONS,
  type CompanyKybRecord,
  type KybBusinessType,
  type ProviderVerificationState,
} from '../../../services/companyKyb'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

type Props = {
  companyId: number
  companyName: string
  companyBusinessLegalName?: string
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

function companyDefaultBusinessName(
  companyBusinessLegalName: string | undefined,
  companyName: string,
): string {
  const legal = companyBusinessLegalName?.trim()
  return legal || companyName
}

function recordToForm(
  record: CompanyKybRecord,
  companyBusinessLegalName: string | undefined,
  companyName: string,
): KybFormState {
  return {
    business_type: record.business_type ?? '',
    merchant_business_name:
      record.merchant_business_name?.trim()
      || companyDefaultBusinessName(companyBusinessLegalName, companyName),
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

function providerBadgeClass(verified: boolean, status: string): string {
  if (verified) return 'text-bg-success'
  if (status.includes('rejected')) return 'text-bg-danger'
  if (status.includes('pending')) return 'text-bg-warning'
  return 'text-bg-secondary'
}

function sanitizeXenditOnboardingUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.toLowerCase().includes('onboarding.xendit.com')) return ''
  return trimmed
}

function ProviderVerificationCard({
  provider,
  onboardingUrl,
  redirecting,
  onContinue,
  onOpenOnboarding,
}: {
  provider: ProviderVerificationState
  onboardingUrl: string
  redirecting: boolean
  onContinue: () => void
  onOpenOnboarding: () => void
}) {
  const pending = provider.status.includes('pending')
  const verified = provider.verified
  const rejected = provider.status.includes('rejected')
  const emailInvitation = provider.verification_flow === 'email_invitation'
  const hostedOnboardingUrl = emailInvitation ? '' : onboardingUrl.trim()
  const continueDisabled =
    redirecting || (Boolean(hostedOnboardingUrl) && pending && !rejected)

  return (
    <section className="company-kyb-provider-card">
      <div className="company-kyb-provider-card__head">
        <h3 className="company-kyb-provider-card__title">{provider.provider_label}</h3>
        <span className={`badge ${providerBadgeClass(verified, provider.status)}`}>
          {provider.status_label}
        </span>
      </div>

      {verified ? (
        <p className="company-kyb-provider-card__detail text-success small mb-0">
          Business verification is complete for {provider.provider_label}.
        </p>
      ) : emailInvitation ? (
        <p className="company-kyb-provider-card__detail text-muted small">
          Xendit verifies merchants by email invitation — there is no hosted
          verification page in this app.
        </p>
      ) : (
        <p className="company-kyb-provider-card__detail text-muted small">
          Complete verification with {provider.provider_label} to accept payments through
          this provider.
        </p>
      )}

      {provider.rejection_notes ? (
        <p className="small text-danger mb-2">{provider.rejection_notes}</p>
      ) : null}

      {(provider.merchant_id || provider.account_id) && (
        <p className="small text-muted mb-2">
          {provider.provider === 'paymongo' ? 'Merchant ID' : 'Account ID'}:{' '}
          <code>{provider.merchant_id || provider.account_id}</code>
        </p>
      )}

      {pending && emailInvitation && provider.invitation_email ? (
        <div className="alert alert-info py-2 small mb-2">
          Check <strong>{provider.invitation_email}</strong> for Xendit&apos;s invitation
          email and follow the link to register and submit verification documents.
        </div>
      ) : null}

      {pending && hostedOnboardingUrl ? (
        <div className="alert alert-info py-2 small mb-2">
          Verification is in progress.{' '}
          <button
            type="button"
            className="btn btn-link btn-sm p-0 align-baseline"
            onClick={onOpenOnboarding}
            disabled={redirecting}
          >
            Open verification again
          </button>
        </div>
      ) : null}

      {!verified && (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onContinue}
          disabled={continueDisabled}
        >
          {redirecting
            ? 'Redirecting…'
            : `Continue to ${provider.provider_label}`}
        </button>
      )}
    </section>
  )
}

const CompanyKybModal = ({
  companyId,
  companyName,
  companyBusinessLegalName,
  onClose,
  onSaved,
  stacked = false,
}: Props) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [redirectingProvider, setRedirectingProvider] = useState<
    'paymongo' | 'xendit' | null
  >(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [record, setRecord] = useState<CompanyKybRecord | null>(null)
  const [form, setForm] = useState<KybFormState>(() =>
    recordToForm(
      {
        business_type: '',
        merchant_business_name: '',
        merchant_email: '',
        merchant_mobile_number: '',
      } as CompanyKybRecord,
      companyBusinessLegalName,
      companyName,
    ),
  )
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [paymongoOnboardingUrl, setPaymongoOnboardingUrl] = useState('')
  const [xenditOnboardingUrl, setXenditOnboardingUrl] = useState('')

  const providers = record?.provider_verifications

  const openOnboardingUrl = (url: string, providerLabel: string) => {
    const trimmed = url.trim()
    if (!trimmed) {
      const message = `${providerLabel} did not return a verification link. Please try again or contact support.`
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
      setPaymongoOnboardingUrl(
        (data.provider_verifications?.paymongo?.onboarding_url || data.onboarding_url || '').trim(),
      )
      setXenditOnboardingUrl(
        sanitizeXenditOnboardingUrl(
          data.provider_verifications?.xendit?.onboarding_url || data.xendit_onboarding_url || '',
        ),
      )
      setForm(recordToForm(data, companyBusinessLegalName, companyName))
      setMissingFields(data.missing_fields ?? [])
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to load verification')
    } finally {
      setLoading(false)
    }
  }, [companyId, companyBusinessLegalName, companyName])

  useEffect(() => {
    void load()
  }, [load])

  const bothProvidersVerified = useMemo(() => {
    if (!providers) return false
    return providers.paymongo.verified && providers.xendit.verified
  }, [providers])

  const anyProviderVerified = providers?.any_provider_verified === true

  const readOnly = bothProvidersVerified

  const showSaveDraft =
    !readOnly
    && ((!paymongoOnboardingUrl && !providers?.paymongo.verified)
      || record?.paymongo_status === 'rejected'
      || (!xenditOnboardingUrl && !providers?.xendit.verified)
      || record?.xendit_status === 'rejected')

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
        ...(record?.paymongo_status === 'rejected' ? { paymongo_status: 'draft' } : {}),
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

  const handleContinuePaymongo = async () => {
    if (!form.business_type) {
      setFormError('Select a business type.')
      return
    }
    setRedirectingProvider('paymongo')
    setFormError(null)
    try {
      const data = await startPaymongoKybOnboarding(companyId, formToPayload(form))
      setRecord(data)
      const url = (
        data.provider_verifications?.paymongo?.onboarding_url || data.onboarding_url || ''
      ).trim()
      setPaymongoOnboardingUrl(url)
      onSaved()
      openOnboardingUrl(url, 'PayMongo')
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to start PayMongo verification'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setRedirectingProvider(null)
    }
  }

  const handleContinueXendit = async () => {
    if (!form.business_type) {
      setFormError('Select a business type.')
      return
    }
    setRedirectingProvider('xendit')
    setFormError(null)
    try {
      const data = await startXenditKybOnboarding(companyId, formToPayload(form))
      setRecord(data)
      setXenditOnboardingUrl('')
      onSaved()
      const invitationEmail = (
        data.provider_verifications?.xendit?.invitation_email
        || form.merchant_email
      ).trim()
      if (data.provider_verifications?.xendit?.verified) {
        showSuccessToast('Xendit business verification is complete.')
      } else if (invitationEmail) {
        showSuccessToast(
          `Xendit invitation sent to ${invitationEmail}. Check your inbox (and spam) to complete verification.`,
        )
      } else {
        showSuccessToast('Xendit verification started.')
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to start Xendit verification'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setRedirectingProvider(null)
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
                    Enter your business details once, then complete verification with
                    PayMongo and/or Xendit. Each company can be verified on both
                    providers. Payment features unlock when at least one provider
                    approves your business.
                  </p>

                  {providers && (
                    <div className="company-kyb-provider-summary mb-3">
                      <span className="text-muted small me-2">Verification status:</span>
                      <span
                        className={`badge me-2 ${providerBadgeClass(
                          providers.paymongo.verified,
                          providers.paymongo.status,
                        )}`}
                      >
                        PayMongo: {providers.paymongo.status_label}
                      </span>
                      <span
                        className={`badge ${providerBadgeClass(
                          providers.xendit.verified,
                          providers.xendit.status,
                        )}`}
                      >
                        Xendit: {providers.xendit.status_label}
                      </span>
                      {anyProviderVerified && (
                        <p className="small text-success mb-0 mt-2">
                          Verified on:{' '}
                          {providers.verified_providers
                            .map((p) => (p === 'paymongo' ? 'PayMongo' : 'Xendit'))
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {rejectionNote && record?.paymongo_status === 'rejected' ? (
                    <div className="alert alert-danger py-2 small">
                      PayMongo: {rejectionNote}
                    </div>
                  ) : null}

                  {record?.xendit_rejection_notes ? (
                    <div className="alert alert-danger py-2 small">
                      Xendit: {record.xendit_rejection_notes}
                    </div>
                  ) : null}

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

                  <div className="row g-3 mb-4">
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

                  {providers && (
                    <div className="company-kyb-provider-grid">
                      <ProviderVerificationCard
                        provider={providers.paymongo}
                        onboardingUrl={paymongoOnboardingUrl}
                        redirecting={redirectingProvider === 'paymongo'}
                        onContinue={() => void handleContinuePaymongo()}
                        onOpenOnboarding={() =>
                          openOnboardingUrl(paymongoOnboardingUrl, 'PayMongo')
                        }
                      />
                      <ProviderVerificationCard
                        provider={providers.xendit}
                        onboardingUrl={xenditOnboardingUrl}
                        redirecting={redirectingProvider === 'xendit'}
                        onContinue={() => void handleContinueXendit()}
                        onOpenOnboarding={() =>
                          openOnboardingUrl(xenditOnboardingUrl, 'Xendit')
                        }
                      />
                    </div>
                  )}

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
                disabled={saving || redirectingProvider !== null}
              >
                Close
              </button>
              {!readOnly && showSaveDraft && (
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => void handleSaveDraft()}
                  disabled={saving || redirectingProvider !== null || loading}
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default CompanyKybModal
