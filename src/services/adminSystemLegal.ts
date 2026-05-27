import {
  apiErrorFromResponse,
  apiFetch,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'

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
  const res = await apiFetch(buildApiUrl(`/admin/system-legal/${name}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load document')
  }
  return readJsonResponse(res, 'Failed to load document')
}

export async function updateAdminSystemLegal(
  name: LegalDocumentName,
  value: string,
): Promise<SystemLegalRecord> {
  const res = await apiFetch(buildApiUrl(`/admin/system-legal/${name}/`), {
    method: 'PATCH',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to save document')
  }
  return readJsonResponse(res, 'Failed to save document')
}
