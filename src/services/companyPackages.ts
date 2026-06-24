import { apiFetch, authHeaders, buildApiUrl } from './api'
import { parseApiList } from './parseApiList'

export type CompanyPackageRecord = {
  id: number
  name: string
  company: number
  is_active: boolean
  created_at: string
}

export type CompanyPackagePayload = {
  name: string
  company?: number
  is_active?: boolean
}

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}

async function packageApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

/** Active packages only (supplier fields, dropdowns). */
export async function fetchCompanyPackages(): Promise<CompanyPackageRecord[]> {
  const res = await apiFetch(buildApiUrl('/packages/?active_only=true'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load packages')
  const data: unknown = await res.json()
  return parseApiList<CompanyPackageRecord>(data)
}

/** All non-deleted packages for settings management, optionally scoped to a company. */
export async function fetchAllCompanyPackages(
  companyId: number,
): Promise<CompanyPackageRecord[]> {
  const params = new URLSearchParams({ company_id: String(companyId) })
  const res = await apiFetch(buildApiUrl(`/packages/?${params.toString()}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load packages')
  const data: unknown = await res.json()
  return parseApiList<CompanyPackageRecord>(data)
}

export async function createCompanyPackage(
  data: CompanyPackagePayload,
): Promise<CompanyPackageRecord> {
  const res = await apiFetch(buildApiUrl('/packages/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await packageApiError(res, 'Failed to create package')
  return res.json()
}

export async function updateCompanyPackage(
  id: number,
  data: Partial<CompanyPackagePayload>,
): Promise<CompanyPackageRecord> {
  const res = await apiFetch(buildApiUrl(`/packages/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await packageApiError(res, 'Failed to update package')
  return res.json()
}

export async function deleteCompanyPackage(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/packages/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw await packageApiError(res, 'Failed to delete package')
}
