import { useCallback, useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { useAuthSession } from '../../../context/AuthSessionContext'
import PayMongoIntegrationCard, {
  PayMongoIntegrationIcon,
  PAYMONGO_INTEGRATION,
} from '../../../components/integrations/PayMongoIntegrationCard'
import {
  fetchActiveCompanies,
  type CompanyRecord,
} from '../../../services/companies'
import {
  disconnectPayMongoIntegration,
  fetchPayMongoIntegration,
  refreshPayMongoIntegration,
  startPayMongoOnboarding,
  type PayMongoIntegrationStatus,
} from '../../../services/paymentIntegrations'
import { showSuccessToast } from '../../../utils/toast'

function pickDefaultCompanyId(
  companies: CompanyRecord[],
  userCompanyId: number | null | undefined,
): number | null {
  const verified = companies.filter((c) => c.kyb_verified)
  if (verified.length === 0) return null
  if (userCompanyId != null) {
    const userCompany = verified.find((c) => c.id === userCompanyId)
    if (userCompany) return userCompany.id
  }
  const main = verified.find((c) => c.is_main)
  return main?.id ?? verified[0].id
}

function companyOptionLabel(company: CompanyRecord): string {
  return company.kyb_verified
    ? `${company.name} — KYB verified`
    : `${company.name} — KYB not verified`
}

const IntegrationsPanel = () => {
  const { currentUser } = useAuthSession()
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  const [status, setStatus] = useState<PayMongoIntegrationStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCompaniesLoading(true)
    void fetchActiveCompanies()
      .then((rows) => {
        if (cancelled) return
        setCompanies(rows)
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

  useEffect(() => {
    if (companies.length === 0) return
    const selected = companies.find((c) => c.id === selectedCompanyId)
    if (selected?.kyb_verified) return
    setSelectedCompanyId(
      pickDefaultCompanyId(companies, currentUser?.company ?? null),
    )
  }, [companies, selectedCompanyId, currentUser?.company])

  const loadStatus = useCallback(async (companyId: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPayMongoIntegration(companyId)
      setStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integration')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompanyId == null) {
      setStatus(null)
      return
    }
    const company = companies.find((c) => c.id === selectedCompanyId)
    if (!company?.kyb_verified) {
      setStatus(null)
      return
    }
    void loadStatus(selectedCompanyId)
  }, [selectedCompanyId, loadStatus, companies])

  const openModal = () => {
    if (!selectedCompany?.kyb_verified) return
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const paymongoConnected = status?.payments_ready === true

  const paymongoStatusLabel = status?.onboarding_status_label ?? '—'

  const handleConnect = async () => {
    if (selectedCompanyId == null) return
    setSaving(true)
    setError(null)
    try {
      const updated = await startPayMongoOnboarding(selectedCompanyId)
      setStatus(updated)
      showSuccessToast('PayMongo onboarding started.')
      if (updated.identity_verification_url) {
        window.open(updated.identity_verification_url, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to start onboarding'
      await Swal.fire('PayMongo onboarding', message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    if (selectedCompanyId == null) return
    setSaving(true)
    try {
      const updated = await refreshPayMongoIntegration(selectedCompanyId)
      setStatus(updated)
      showSuccessToast('PayMongo status updated.')
    } catch (e) {
      await Swal.fire(
        'Error',
        e instanceof Error ? e.message : 'Failed to refresh status',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (selectedCompanyId == null) return
    const result = await Swal.fire({
      title: 'Disconnect PayMongo?',
      text: 'This company will no longer accept payments until PayMongo is connected again.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Disconnect',
      confirmButtonColor: '#d65a5a',
    })
    if (!result.isConfirmed) return
    setSaving(true)
    try {
      const updated = await disconnectPayMongoIntegration(selectedCompanyId)
      setStatus(updated)
      showSuccessToast('PayMongo disconnected.')
    } catch (e) {
      await Swal.fire(
        'Error',
        e instanceof Error ? e.message : 'Failed to disconnect',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)
  const selectedKybVerified = selectedCompany?.kyb_verified === true
  const hasVerifiedCompany = companies.some((c) => c.kyb_verified)

  const needsVerification =
    status != null &&
    !status.payments_ready &&
    Boolean(status.identity_verification_url)

  return (
    <>
      <div className="row g-2 align-items-end mb-3">
        <div className="col-sm-8 col-md-5">
          <label className="form-label mb-1" htmlFor="integrations-company">
            Company
          </label>
          <select
            id="integrations-company"
            className="form-select form-select-sm"
            value={selectedCompanyId ?? ''}
            disabled={companiesLoading || companies.length === 0}
            onChange={(e) => {
              const raw = e.target.value
              setSelectedCompanyId(raw === '' ? null : Number(raw))
            }}
          >
            {companies.length === 0 ? (
              <option value="">No active companies</option>
            ) : !hasVerifiedCompany ? (
              <option value="">No KYB-verified companies</option>
            ) : (
              companies.map((company) => (
                <option
                  key={company.id}
                  value={company.id}
                  disabled={!company.kyb_verified}
                >
                  {companyOptionLabel(company)}
                </option>
              ))
            )}
          </select>
          {companies.length > 0 && !hasVerifiedCompany && (
            <div className="form-text text-warning">
              Complete KYB verification for a company before configuring
              payment integrations.
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-danger small mb-2">{error}</p>
      )}

      {!selectedKybVerified && hasVerifiedCompany && selectedCompany && (
        <p className="text-warning small mb-2">
          Select a KYB-verified company to manage payment integrations.
        </p>
      )}

      {loading && !status && selectedKybVerified ? (
        <p className="text-muted small mb-0">Loading integrations…</p>
      ) : selectedKybVerified ? (
        <ul className="connection-grid connection-grid--single">
          <PayMongoIntegrationCard
            connected={paymongoConnected}
            statusLabel={paymongoStatusLabel}
            onViewIntegration={openModal}
          />
        </ul>
      ) : !hasVerifiedCompany && !companiesLoading ? (
        <p className="text-muted small mb-0">
          Payment integrations are available after KYB verification is approved.
        </p>
      ) : null}

      {status && !status.platform_configured && (
        <p className="text-warning small mt-2 mb-0">
          Platform PayMongo is not configured on the server. Contact support.
        </p>
      )}

      {status && status.platform_configured && !status.platform_merchant_configured && (
        <p className="text-warning small mt-2 mb-0">
          Platform merchant id is not configured. Contact support to enable split
          payouts.
        </p>
      )}

      {modalOpen && selectedCompanyId != null && (
        <>
          <div
            className="integration-modal-backdrop modal-backdrop fade show"
            onClick={closeModal}
          />
          <div
            className="integration-modal modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="companyPaymongoModalTitle"
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <div className="integration-modal-title-wrap">
                    <span className="integration-modal-icon" aria-hidden="true">
                      <PayMongoIntegrationIcon />
                    </span>
                    <div>
                      <h1 id="companyPaymongoModalTitle" className="modal-title fs-5">
                        {PAYMONGO_INTEGRATION.name}
                      </h1>
                      <span className="text-muted small d-block">
                        {selectedCompany?.name}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeModal}
                  />
                </div>

                <div className="modal-body">
                  <p className="integration-modal-desc">
                    Connect this company as a PayMongo sub-merchant under our
                    platform. Customer payments are collected on the company&apos;s
                    linked account; our 1% platform fee is split automatically at
                    payment time.
                  </p>

                  <dl className="integration-modal-details mb-3">
                    <div>
                      <dt>Status</dt>
                      <dd>{status?.onboarding_status_label ?? '—'}</dd>
                    </div>
                    {status?.paymongo_account_id && (
                      <div>
                        <dt>PayMongo account</dt>
                        <dd className="font-monospace small">
                          {status.paymongo_account_id}
                        </dd>
                      </div>
                    )}
                    {status?.identity_verification_status && (
                      <div>
                        <dt>Identity verification</dt>
                        <dd>{status.identity_verification_status}</dd>
                      </div>
                    )}
                    {status?.activation_status && (
                      <div>
                        <dt>Activation</dt>
                        <dd>{status.activation_status}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="integration-modal-note mb-3">
                    <i className="bi bi-info-circle" aria-hidden="true" />
                    <span>
                      You do not need your own PayMongo API keys. After our KYB
                      approval, complete PayMongo&apos;s representative verification
                      (government ID and selfie). Once activated, payment links use
                      real-time split: 1% to the platform, the remainder to this
                      company.
                    </span>
                  </div>

                  {needsVerification && (
                    <p className="mb-3">
                      <a
                        href={status.identity_verification_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        Open PayMongo verification
                      </a>
                    </p>
                  )}
                </div>

                <div className="modal-footer flex-wrap">
                  {status?.paymongo_account_id && (
                    <button
                      type="button"
                      className="btn btn-outline-danger me-auto"
                      disabled={saving}
                      onClick={() => void handleDisconnect()}
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={saving || !status?.paymongo_account_id}
                    onClick={() => void handleRefresh()}
                  >
                    Refresh status
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saving}
                    onClick={closeModal}
                  >
                    Close
                  </button>
                  {!status?.payments_ready && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving || !status?.platform_configured}
                      onClick={() => void handleConnect()}
                    >
                      {saving
                        ? 'Working…'
                        : status?.paymongo_account_id
                          ? 'Continue onboarding'
                          : 'Connect PayMongo'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default IntegrationsPanel
