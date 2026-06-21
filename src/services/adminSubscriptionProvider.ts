import { apiFetch, authHeaders, buildApiUrl } from './api'

export type SubscriptionPaymentProvider = 'paymongo' | 'xendit'

export type SubscriptionPaymentProviderStatus = {
  provider: SubscriptionPaymentProvider
  provider_label: string
  paymongo_configured: boolean
  xendit_configured: boolean
  configured: boolean
}

export async function fetchAdminSubscriptionPaymentProvider(): Promise<SubscriptionPaymentProviderStatus> {
  const res = await apiFetch(buildApiUrl('/admin/subscription-payment-provider/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load subscription payment provider settings')
  return res.json()
}

export async function updateAdminSubscriptionPaymentProvider(
  provider: SubscriptionPaymentProvider,
): Promise<SubscriptionPaymentProviderStatus> {
  const res = await apiFetch(buildApiUrl('/admin/subscription-payment-provider/'), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider }),
  })
  if (!res.ok) {
    let detail = 'Failed to update subscription payment provider'
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json()
}
