import { apiFetch, authHeaders, buildApiUrl } from './api'
import { parseApiList } from './parseApiList'

export type PackageVersionRecord = {
  id: number
  title: string
  description: string
  effectivity_date: string | null
  is_active: boolean
  company: number
  created_at: string
}

export type PackageVersionPayload = {
  title: string
  description?: string
  effectivity_date?: string | null
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

async function packageVersionApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchPackageVersions(
  companyId: number,
  options?: { activeOnly?: boolean },
): Promise<PackageVersionRecord[]> {
  const params = new URLSearchParams({ company_id: String(companyId) })
  if (options?.activeOnly) {
    params.set('active_only', 'true')
  }
  const res = await apiFetch(buildApiUrl(`/package-versions/?${params.toString()}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load package versions')
  const data: unknown = await res.json()
  return parseApiList<PackageVersionRecord>(data)
}

export async function createPackageVersion(
  data: PackageVersionPayload,
): Promise<PackageVersionRecord> {
  const res = await apiFetch(buildApiUrl('/package-versions/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await packageVersionApiError(res, 'Failed to create package version')
  return res.json()
}
