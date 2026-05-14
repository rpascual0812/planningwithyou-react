import { apiFetch, buildApiUrl } from './api'
import { getAccessToken } from './auth'

export type DocumentRecord = {
  id: number
  file: string
  original_name: string
  mime_type: string
  size: number
  extension: string
  is_image: boolean
  url: string
  uploaded_by: number | null
  created_at: string
}

export async function fetchDocuments(
  search = '',
): Promise<DocumentRecord[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const token = getAccessToken()
  const res = await apiFetch(buildApiUrl(`/api/documents/${qs}`), {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error('Failed to load documents')
  return res.json()
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const formData = new FormData()
  formData.append('file', file)

  const token = getAccessToken()
  const res = await apiFetch(buildApiUrl('/api/documents/'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to upload document')
  }
  return res.json()
}

export async function deleteDocument(id: number): Promise<void> {
  const token = getAccessToken()
  const res = await apiFetch(buildApiUrl(`/api/documents/${id}/`), {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error('Failed to delete document')
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
