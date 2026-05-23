import { apiFetch, authHeaders, buildApiUrl } from './api'

export type PayMongoIntegrationStatus = {
  payment_gateway: 'paymongo'
  uses_platform_defaults: boolean
  has_custom_credentials: boolean
  key_masked: string
  webhook_secret_set: boolean
  platform_configured: boolean
}

export type PayMongoIntegrationPayload = {
  key: string
  secret?: string
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

export async function savePayMongoIntegration(
  companyId: number,
  payload: PayMongoIntegrationPayload,
): Promise<PayMongoIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl(`/api/companies/${companyId}/payment-integrations/paymongo/`),
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to save PayMongo integration')
  }
  return res.json()
}

export async function clearPayMongoIntegration(
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
    throw await integrationApiError(res, 'Failed to clear PayMongo integration')
  }
  return res.json()
}
