import { apiFetch, authHeaders, buildApiUrl } from './api'
import { getAccessToken } from './auth'
import type { DocumentRecord } from './documents'

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}

export async function fetchQuotationDocuments(
  quotationId: number,
): Promise<DocumentRecord[]> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${quotationId}/documents/`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load quotation documents')
  return res.json()
}

export async function uploadQuotationDocument(
  quotationId: number,
  file: File,
): Promise<DocumentRecord> {
  const formData = new FormData()
  formData.append('file', file)
  const token = getAccessToken()
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${quotationId}/documents/`),
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to upload document')
  }
  return res.json()
}

export async function attachQuotationDocumentFromFileManager(
  quotationId: number,
  documentId: number,
): Promise<DocumentRecord> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${quotationId}/documents/attach/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ document_id: documentId }),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to attach document')
  }
  return res.json()
}

export async function deleteQuotationDocument(
  quotationId: number,
  documentId: number,
): Promise<void> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${quotationId}/documents/${documentId}/`),
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  if (!res.ok) throw new Error('Failed to remove document')
}
