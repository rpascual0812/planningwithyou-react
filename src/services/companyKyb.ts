import { apiFetch, authHeaders, buildApiUrl } from './api'

export type KybBusinessType = 'sole_proprietor' | 'corporation' | ''

export type KybStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export type OwnerDirectorIdFile = string | { label: string; file: string }

export type CompanyKybRecord = {
  id: number
  company: number
  business_type: KybBusinessType
  status: KybStatus
  government_id_file: string
  dti_registration_file: string
  sole_prop_business_address: string
  sole_prop_mobile_number: string
  bank_account_same_name: string
  sec_registration_file: string
  articles_of_incorporation_file: string
  bir_registration_file: string
  owner_director_id_files: OwnerDirectorIdFile[]
  business_website_social: string
  company_email_domain: string
  proof_of_address_file: string
  business_description: string
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: number | null
  rejection_notes: string
  live_payments_allowed: boolean
  missing_fields: string[]
  created_at: string
  updated_at: string
}

export type CompanyKybPayload = Partial<
  Omit<
    CompanyKybRecord,
    | 'id'
    | 'company'
    | 'submitted_at'
    | 'reviewed_at'
    | 'reviewed_by'
    | 'live_payments_allowed'
    | 'missing_fields'
    | 'created_at'
    | 'updated_at'
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
  const res = await apiFetch(buildApiUrl(`/api/companies/${companyId}/kyb/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw await kybApiError(res, 'Failed to load KYB verification')
  return res.json()
}

export async function updateCompanyKyb(
  companyId: number,
  data: CompanyKybPayload,
): Promise<CompanyKybRecord> {
  const res = await apiFetch(buildApiUrl(`/api/companies/${companyId}/kyb/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await kybApiError(res, 'Failed to save KYB verification')
  return res.json()
}
