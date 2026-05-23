import { apiFetch, authHeaders, buildApiUrl } from './api'

export type PayMongoIntegrationStatus = {
  payment_gateway: 'paymongo'
  platform_configured: boolean
  platform_merchant_configured: boolean
  paymongo_account_id: string
  activation_status: string
  identity_verification_status: string
  identity_verification_url: string
  payments_ready: boolean
  onboarding_status_label: string
}

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}

async function integrationApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchPayMongoIntegration(
  companyId: number,
): Promise<PayMongoIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl(`/api/companies/${companyId}/payment-integrations/paymongo/`),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to load PayMongo integration')
  }
  return res.json()
}

/** Start or continue PayMongo Platforms onboarding (create child account, KYC link). */
export async function startPayMongoOnboarding(
  companyId: number,
): Promise<PayMongoIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl(`/api/companies/${companyId}/payment-integrations/paymongo/`),
    {
      method: 'PUT',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to start PayMongo onboarding')
  }
  return res.json()
}

export async function refreshPayMongoIntegration(
  companyId: number,
): Promise<PayMongoIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl(
      `/api/companies/${companyId}/payment-integrations/paymongo/refresh/`,
    ),
    {
      method: 'POST',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to refresh PayMongo status')
  }
  return res.json()
}

export async function disconnectPayMongoIntegration(
  companyId: number,
): Promise<PayMongoIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl(`/api/companies/${companyId}/payment-integrations/paymongo/`),
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to disconnect PayMongo')
  }
  return res.json()
}
