import { apiFetch, authHeaders, buildApiUrl } from './api'

export type AccessLevel = 'none' | 'read' | 'write'

export type RoleRecord = {
  id: number
  name: string
  is_default: boolean
  permissions: Record<string, AccessLevel>
  user_count: number
  created_at: string
  updated_at: string
}

export type FeatureCatalogItem = {
  key: string
  label: string
}

export type RolePayload = {
  name: string
  is_default?: boolean
  permissions: Record<string, AccessLevel>
}

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
      return val[0]
    }
  }
  return ''
}

async function roleApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchRoles(): Promise<RoleRecord[]> {
  const res = await apiFetch(buildApiUrl('/roles/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load roles')
  return res.json()
}

export async function fetchRoleFeatureCatalog(): Promise<FeatureCatalogItem[]> {
  const res = await apiFetch(buildApiUrl('/roles/feature-catalog/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load permission features')
  return res.json()
}

export async function createRole(data: RolePayload): Promise<RoleRecord> {
  const res = await apiFetch(buildApiUrl('/roles/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await roleApiError(res, 'Failed to create role')
  return res.json()
}

export async function updateRole(id: number, data: RolePayload): Promise<RoleRecord> {
  const res = await apiFetch(buildApiUrl(`/roles/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw await roleApiError(res, 'Failed to update role')
  return res.json()
}

export async function deleteRole(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/roles/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw await roleApiError(res, 'Failed to delete role')
}

export function emptyPermissions(
  catalog: FeatureCatalogItem[],
): Record<string, AccessLevel> {
  return Object.fromEntries(catalog.map((f) => [f.key, 'none' as AccessLevel]))
}
