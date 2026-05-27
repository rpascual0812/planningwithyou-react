import { apiFetch, authHeaders, buildApiUrl } from './api'

export type KybBusinessType =
  | 'individual'
  | 'sole_proprietor'
  | 'partnership'
  | 'corporation'
  | ''

export const KYB_BUSINESS_TYPE_OPTIONS: {
  value: Exclude<KybBusinessType, ''>
  label: string
}[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'sole_proprietor', label: 'Sole proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'corporation', label: 'Corporation' },
]

export type KybStatus =
  | 'draft'
  | 'pending_paymongo'
  | 'approved'
  | 'rejected'

export type CompanyKybRecord = {
  id: number
  company: number
  company_name?: string
  business_type: KybBusinessType
  status: KybStatus
  paymongo_merchant_id: string
  onboarding_url: string
  merchant_business_name: string
  merchant_email: string
  merchant_mobile_number: string
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: number | null
  rejection_notes: string
  rejection_reason?: string
  live_payments_allowed: boolean
  missing_fields: string[]
  created_at: string
  updated_at: string
}

export type CompanyKybPayload = Partial<
  Pick<
    CompanyKybRecord,
    | 'business_type'
    | 'merchant_business_name'
    | 'merchant_email'
    | 'merchant_mobile_number'
    | 'status'
    | 'rejection_notes'
  >
>

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

async function kybApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchCompanyKyb(companyId: number): Promise<CompanyKybRecord> {
  const res = await apiFetch(buildApiUrl(`/companies/${companyId}/kyb/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw await kybApiError(res, 'Failed to load KYB verification')
  return res.json()
}

export async function updateCompanyKyb(
  companyId: number,
  data: CompanyKybPayload,
): Promise<CompanyKybRecord> {
  const res = await apiFetch(buildApiUrl(`/companies/${companyId}/kyb/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await kybApiError(res, 'Failed to save KYB verification')
  return res.json()
}

export async function startPaymongoKybOnboarding(
  companyId: number,
  data: CompanyKybPayload & { regenerate_link?: boolean },
): Promise<CompanyKybRecord> {
  const res = await apiFetch(
    buildApiUrl(`/companies/${companyId}/kyb/start-paymongo/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    },
  )
  if (!res.ok) throw await kybApiError(res, 'Failed to start PayMongo verification')
  return res.json()
}
