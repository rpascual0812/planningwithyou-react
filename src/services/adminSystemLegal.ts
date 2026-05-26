import { apiFetch, authHeaders, buildApiUrl } from './api'

export type LegalDocumentName =
  | 'privacy_policy'
  | 'terms_condition'
  | 'terms_use'

export type SystemLegalRecord = {
  id: number
  name: LegalDocumentName
  value: string
}

export async function fetchAdminSystemLegal(
  name: LegalDocumentName,
): Promise<SystemLegalRecord> {
  const res = await apiFetch(buildApiUrl(`/api/admin/system-legal/${name}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load document')
  return res.json()
}

export async function updateAdminSystemLegal(
  name: LegalDocumentName,
  value: string,
): Promise<SystemLegalRecord> {
  const res = await apiFetch(buildApiUrl(`/api/admin/system-legal/${name}/`), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error('Failed to save document')
  return res.json()
}
