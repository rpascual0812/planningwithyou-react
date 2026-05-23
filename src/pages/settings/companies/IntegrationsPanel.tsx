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
  clearPayMongoIntegration,
  fetchPayMongoIntegration,
  savePayMongoIntegration,
  type PayMongoIntegrationStatus,
} from '../../../services/paymentIntegrations'
import { showSuccessToast } from '../../../utils/toast'

function pickDefaultCompanyId(
  companies: CompanyRecord[],
  userCompanyId: number | null | undefined,
): number | null {
  if (userCompanyId != null && companies.some((c) => c.id === userCompanyId)) {
    return userCompanyId
  }
  if (companies.length === 0) return null
  const main = companies.find((c) => c.is_main)
  return main?.id ?? companies[0].id
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
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
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
    if (companies.length > 0 && selectedCompanyId == null) {
      setSelectedCompanyId(
        pickDefaultCompanyId(companies, currentUser?.company ?? null),
      )
    }
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
    if (selectedCompanyId == null) return
    void loadStatus(selectedCompanyId)
  }, [selectedCompanyId, loadStatus])

  const openModal = () => {
    setSecretKey('')
    setWebhookSecret('')
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const paymongoConnected =
    status != null &&
    (status.has_custom_credentials || status.platform_configured)

  const paymongoStatusLabel = (() => {
    if (!status) return '—'
    if (status.has_custom_credentials) return 'Custom account'
    if (status.platform_configured) return 'Platform default'
    return 'Not configured'
  })()

  const handleSave = async () => {
    if (selectedCompanyId == null) return
    const key = secretKey.trim()
    if (!key) {
      await Swal.fire('Missing key', 'Enter your PayMongo secret API key.', 'warning')
      return
    }
    setSaving(true)
    try {
      const updated = await savePayMongoIntegration(selectedCompanyId, {
        key,
        secret: webhookSecret.trim() || undefined,
      })
      setStatus(updated)
      showSuccessToast('PayMongo credentials saved.')
      closeModal()
    } catch (e) {
      await Swal.fire(
        'Error',
        e instanceof Error ? e.message : 'Failed to save credentials',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleUsePlatformDefault = async () => {
    if (selectedCompanyId == null || !status?.has_custom_credentials) return
    const result = await Swal.fire({
      title: 'Use platform PayMongo?',
      text: 'Payments for this company will use the server PayMongo keys instead of your own account.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Use platform default',
      confirmButtonColor: '#198754',
    })
    if (!result.isConfirmed) return
    setSaving(true)
    try {
      const updated = await clearPayMongoIntegration(selectedCompanyId)
      setStatus(updated)
      showSuccessToast('Using platform PayMongo credentials.')
      closeModal()
    } catch (e) {
      await Swal.fire(
        'Error',
        e instanceof Error ? e.message : 'Failed to clear credentials',
        'error',
      )
    } finally {
      setSaving(false)
    }
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)

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
            ) : (
              companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-danger small mb-2">{error}</p>
      )}

      {loading && !status ? (
        <p className="text-muted small mb-0">Loading integrations…</p>
      ) : (
        <ul className="connection-grid connection-grid--single">
          <PayMongoIntegrationCard
            connected={paymongoConnected}
            statusLabel={paymongoStatusLabel}
            onViewIntegration={openModal}
          />
        </ul>
      )}

      {status && !status.platform_configured && !status.has_custom_credentials && (
        <p className="text-warning small mt-2 mb-0">
          Platform PayMongo is not configured on the server. Add your own keys
          for {selectedCompany?.name ?? 'this company'} or contact support.
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
                    {PAYMONGO_INTEGRATION.description}
                  </p>

                  <dl className="integration-modal-details mb-3">
                    <div>
                      <dt>Mode</dt>
                      <dd>
                        {status?.has_custom_credentials
                          ? 'Company PayMongo account'
                          : 'Platform default (server keys)'}
                      </dd>
                    </div>
                    {status?.has_custom_credentials && status.key_masked && (
                      <div>
                        <dt>Secret key</dt>
                        <dd className="font-monospace">{status.key_masked}</dd>
                      </div>
                    )}
                    {status?.has_custom_credentials && (
                      <div>
                        <dt>Webhook secret</dt>
                        <dd>
                          {status.webhook_secret_set ? 'Configured' : 'Not set'}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="integration-modal-note mb-3">
                    <i className="bi bi-info-circle" aria-hidden="true" />
                    <span>
                      Leave custom credentials empty to use the platform
                      PayMongo account. When you add keys here, checkout and
                      webhooks for this company use your PayMongo merchant
                      account.
                    </span>
                  </div>

                  <h6 className="mb-2">Custom PayMongo credentials</h6>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="paymongo-secret-key">
                      Secret API key
                    </label>
                    <input
                      id="paymongo-secret-key"
                      type="password"
                      className="form-control form-control-sm"
                      autoComplete="off"
                      placeholder="sk_live_…"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label" htmlFor="paymongo-webhook-secret">
                      Webhook secret
                    </label>
                    <input
                      id="paymongo-webhook-secret"
                      type="password"
                      className="form-control form-control-sm"
                      autoComplete="off"
                      placeholder={
                        status?.webhook_secret_set
                          ? 'Leave blank to keep current'
                          : 'whsec_…'
                      }
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                    />
                    
                  </div>
                </div>

                <div className="modal-footer flex-wrap">
                  {status?.has_custom_credentials && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary me-auto"
                      disabled={saving}
                      onClick={() => void handleUsePlatformDefault()}
                    >
                      Use platform default
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={saving}
                    onClick={closeModal}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={() => void handleSave()}
                  >
                    {saving ? 'Saving…' : 'Save credentials'}
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

export default IntegrationsPanel
