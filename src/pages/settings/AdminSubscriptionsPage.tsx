import { useCallback, useEffect, useState } from 'react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import {
  fetchAdminSubscriptionPaymentProvider,
  updateAdminSubscriptionPaymentProvider,
  type SubscriptionPaymentProvider,
  type SubscriptionPaymentProviderStatus,
} from '../../services/adminSubscriptionProvider'
import {
  fetchAdminSubscriptionPlanPricing,
  updateAdminSubscriptionPlanPricing,
  type SubscriptionPlanPricingSettings,
} from '../../services/adminSubscriptionPlanPricing'
import { showErrorToast, showSuccessToast } from '../../utils/toast'

type ProviderCard = {
  id: SubscriptionPaymentProvider
  name: string
  description: string
  iconClass: string
  color: string
}

const PROVIDER_CARDS: ProviderCard[] = [
  {
    id: 'paymongo',
    name: 'PayMongo',
    description:
      'Collect subscription payments through PayMongo hosted checkout and recurring billing.',
    iconClass: 'bi-credit-card-2-front',
    color: '#00b894',
  },
  {
    id: 'xendit',
    name: 'Xendit',
    description:
      'Collect subscription payments through Xendit payment sessions and recurring plans.',
    iconClass: 'bi-wallet2',
    color: '#2563eb',
  },
]

const EMPTY_PRICING: SubscriptionPlanPricingSettings = {
  pro: { base_price: '995.00', price_per_user: '100.00' },
  ai: { base_price: '1495.00', price_per_user: '150.00' },
  admin: { base_price: '0.00', price_per_user: '0.00' },
}

const AdminSubscriptionsPage = () => {
  const { canWrite: subscriptionsWrite } = useFeatureAccess('admin_subscriptions')
  const [providerOpen, setProviderOpen] = useState(true)
  const [pricingOpen, setPricingOpen] = useState(true)
  const [status, setStatus] = useState<SubscriptionPaymentProviderStatus | null>(null)
  const [pricing, setPricing] = useState<SubscriptionPlanPricingSettings>(EMPTY_PRICING)
  const [loading, setLoading] = useState(true)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pricingSaving, setPricingSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pricingError, setPricingError] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminSubscriptionPaymentProvider()
      setStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscription settings')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPricing = useCallback(async () => {
    setPricingLoading(true)
    setPricingError(null)
    try {
      const data = await fetchAdminSubscriptionPlanPricing()
      setPricing({ ...EMPTY_PRICING, ...data, admin: data.admin ?? EMPTY_PRICING.admin })
    } catch (e) {
      setPricingError(
        e instanceof Error ? e.message : 'Failed to load subscription plan pricing',
      )
    } finally {
      setPricingLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
    void loadPricing()
  }, [loadPricing, loadStatus])

  const handleSelectProvider = async (provider: SubscriptionPaymentProvider) => {
    if (!subscriptionsWrite || saving || status?.provider === provider) return
    setSaving(true)
    setError(null)
    try {
      const data = await updateAdminSubscriptionPaymentProvider(provider)
      setStatus(data)
      showSuccessToast(`${data.provider_label} is now the default subscription payment provider.`)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to update subscription payment provider'
      setError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const handlePricingFieldChange = (
    plan: 'pro' | 'ai' | 'admin',
    field: 'base_price' | 'price_per_user',
    value: string,
  ) => {
    setPricing((current) => ({
      ...current,
      [plan]: {
        ...current[plan],
        [field]: value,
      },
    }))
  }

  const handleSavePricing = async () => {
    if (!subscriptionsWrite || pricingSaving) return
    setPricingSaving(true)
    setPricingError(null)
    try {
      const data = await updateAdminSubscriptionPlanPricing(pricing)
      setPricing(data)
      showSuccessToast('Subscription plan prices updated.')
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to update subscription plan pricing'
      setPricingError(message)
      showErrorToast(message)
    } finally {
      setPricingSaving(false)
    }
  }

  return (
    <div className="admin-subscriptions">
      <p className="text-muted small mb-3">
        Manage subscription billing and plan prices shown in Account Settings → Subscription.
      </p>

      <ul className="faq-list">
        <li className={`faq-item${pricingOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={pricingOpen}
            onClick={() => setPricingOpen((open) => !open)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-tags" />
            </span>
            <span className="faq-question">Plan pricing (PHP / month)</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {pricingOpen && (
            <div className="faq-answer faq-answer--form">
              {pricingLoading ? (
                <p className="text-muted small mb-0">Loading…</p>
              ) : (
                <>
                  {pricingError && <p className="text-danger small">{pricingError}</p>}
                  <p className="text-muted small mb-3">
                    Stored in the system settings table. Yearly billing still uses 10 months of
                    the monthly rate. Additional users are charged per seat above the first user.
                  </p>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <h6 className="mb-2">Pro</h6>
                      <label className="form-label small mb-1" htmlFor="pro-base-price">
                        Base price (1 user)
                      </label>
                      <input
                        id="pro-base-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="form-control form-control-sm mb-2"
                        value={pricing.pro.base_price}
                        disabled={!subscriptionsWrite || pricingSaving}
                        onChange={(e) =>
                          handlePricingFieldChange('pro', 'base_price', e.target.value)
                        }
                      />
                      <label className="form-label small mb-1" htmlFor="pro-price-per-user">
                        Price per additional user
                      </label>
                      <input
                        id="pro-price-per-user"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        value={pricing.pro.price_per_user}
                        disabled={!subscriptionsWrite || pricingSaving}
                        onChange={(e) =>
                          handlePricingFieldChange('pro', 'price_per_user', e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <h6 className="mb-2">AI Plus</h6>
                      <label className="form-label small mb-1" htmlFor="ai-base-price">
                        Base price (1 user)
                      </label>
                      <input
                        id="ai-base-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="form-control form-control-sm mb-2"
                        value={pricing.ai.base_price}
                        disabled={!subscriptionsWrite || pricingSaving}
                        onChange={(e) =>
                          handlePricingFieldChange('ai', 'base_price', e.target.value)
                        }
                      />
                      <label className="form-label small mb-1" htmlFor="ai-price-per-user">
                        Price per additional user
                      </label>
                      <input
                        id="ai-price-per-user"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        value={pricing.ai.price_per_user}
                        disabled={!subscriptionsWrite || pricingSaving}
                        onChange={(e) =>
                          handlePricingFieldChange('ai', 'price_per_user', e.target.value)
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <h6 className="mb-2">Admin</h6>
                      <p className="text-muted small mb-2">
                        Visible only to platform admins. Zero is allowed.
                      </p>
                      <label className="form-label small mb-1" htmlFor="admin-base-price">
                        Base price (1 user)
                      </label>
                      <input
                        id="admin-base-price"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm mb-2"
                        value={pricing.admin.base_price}
                        disabled={!subscriptionsWrite || pricingSaving}
                        onChange={(e) =>
                          handlePricingFieldChange('admin', 'base_price', e.target.value)
                        }
                      />
                      <label className="form-label small mb-1" htmlFor="admin-price-per-user">
                        Price per additional user
                      </label>
                      <input
                        id="admin-price-per-user"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm"
                        value={pricing.admin.price_per_user}
                        disabled={!subscriptionsWrite || pricingSaving}
                        onChange={(e) =>
                          handlePricingFieldChange('admin', 'price_per_user', e.target.value)
                        }
                      />
                    </div>
                  </div>
                  {subscriptionsWrite ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm mt-3"
                      disabled={pricingSaving}
                      onClick={() => void handleSavePricing()}
                    >
                      {pricingSaving ? 'Saving…' : 'Save plan prices'}
                    </button>
                  ) : (
                    <p className="text-muted small mb-0 mt-3">
                      You have read-only access to subscription plan pricing.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </li>

        <li className={`faq-item${providerOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="faq-toggle"
            aria-expanded={providerOpen}
            onClick={() => setProviderOpen((open) => !open)}
          >
            <span className="faq-icon" aria-hidden="true">
              <i className="bi bi-credit-card" />
            </span>
            <span className="faq-question">Payment provider</span>
            <span className="faq-chevron" aria-hidden="true">
              <i className="bi bi-chevron-down" />
            </span>
          </button>
          {providerOpen && (
            <div className="faq-answer faq-answer--form">
              {loading ? (
                <p className="text-muted small mb-0">Loading…</p>
              ) : error && !status ? (
                <p className="text-danger small mb-0">{error}</p>
              ) : (
                <>
                  {error && <p className="text-danger small">{error}</p>}
                  <p className="text-muted small mb-3">
                    Default:{' '}
                    <strong>{status?.provider_label ?? 'PayMongo'}</strong>
                    {!status?.configured && status?.provider && (
                      <>
                        {' '}
                        <span className="text-warning">
                          ({status.provider_label} is not configured on the server yet)
                        </span>
                      </>
                    )}
                  </p>
                  <ul className="connection-grid admin-subscription-provider-grid">
                    {PROVIDER_CARDS.map((card) => {
                      const selected = status?.provider === card.id
                      const configured =
                        card.id === 'paymongo'
                          ? status?.paymongo_configured
                          : status?.xendit_configured
                      return (
                        <li key={card.id}>
                          <button
                            type="button"
                            className={`connection-card admin-subscription-provider-card${
                              selected ? ' is-selected' : ''
                            }`}
                            aria-pressed={selected}
                            disabled={!subscriptionsWrite || saving}
                            onClick={() => void handleSelectProvider(card.id)}
                          >
                            <header className="connection-card-head">
                              <span className="connection-icon" aria-hidden="true">
                                <i
                                  className={`bi ${card.iconClass}`}
                                  style={{ color: card.color }}
                                />
                              </span>
                              <span className="connection-name">{card.name}</span>
                              {selected && (
                                <span className="badge text-bg-primary admin-subscription-provider-card__badge">
                                  Default
                                </span>
                              )}
                            </header>
                            <p className="connection-desc">{card.description}</p>
                            <footer className="connection-card-foot">
                              {configured ? (
                                <span className="small text-success">Configured on server</span>
                              ) : (
                                <span className="small text-warning">
                                  Not configured on server
                                </span>
                              )}
                            </footer>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {!subscriptionsWrite && (
                    <p className="text-muted small mb-0 mt-3">
                      You have read-only access to subscription provider settings.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </li>
      </ul>
    </div>
  )
}

export default AdminSubscriptionsPage
