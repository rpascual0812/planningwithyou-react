import { apiFetch, authHeaders, buildApiUrl } from './api'
import { getAccessToken } from './auth'

/* ── Types ── */

export type FolderRecord = {
  id: number
  name: string
  document_count: number
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type DocumentRecord = {
  id: number
  file: string
  original_name: string
  mime_type: string
  size: number
  extension: string
  is_image: boolean
  url: string
  folder: number | null
  folder_name: string
  uploaded_by: number | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
}

/* ── Folders ── */

export async function fetchFolders(
  deleted = false,
): Promise<FolderRecord[]> {
  const params = new URLSearchParams()
  if (deleted) params.set('deleted', 'true')
  const qs = params.toString() ? `?${params}` : ''
  const res = await apiFetch(buildApiUrl(`/api/document-folders/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load folders')
  return res.json()
}

export async function createFolder(name: string): Promise<FolderRecord> {
  const res = await apiFetch(buildApiUrl('/api/document-folders/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create folder')
  return res.json()
}

export async function renameFolder(
  id: number,
  name: string,
): Promise<FolderRecord> {
  const res = await apiFetch(buildApiUrl(`/api/document-folders/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to rename folder')
  return res.json()
}

export async function deleteFolder(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/api/document-folders/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete folder')
}

export async function restoreFolder(id: number): Promise<FolderRecord> {
  const res = await apiFetch(
    buildApiUrl(`/api/document-folders/${id}/restore/`),
    { method: 'POST', headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to restore folder')
  return res.json()
}

/* ── Documents ── */

export async function fetchDocuments(opts?: {
  search?: string
  folder?: number
  deleted?: boolean
}): Promise<DocumentRecord[]> {
  const params = new URLSearchParams()
  if (opts?.search) params.set('search', opts.search)
  if (opts?.folder) params.set('folder', String(opts.folder))
  if (opts?.deleted) params.set('deleted', 'true')
  const qs = params.toString() ? `?${params}` : ''

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

export async function uploadDocument(
  file: File,
  folderId?: number,
): Promise<DocumentRecord> {
  const formData = new FormData()
  formData.append('file', file)
  if (folderId) formData.append('folder', String(folderId))

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
  const res = await apiFetch(buildApiUrl(`/api/documents/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete document')
}

export async function restoreDocument(id: number): Promise<DocumentRecord> {
  const res = await apiFetch(buildApiUrl(`/api/documents/${id}/restore/`), {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to restore document')
  return res.json()
}

export async function moveDocument(
  id: number,
  folderId: number,
): Promise<DocumentRecord> {
  const res = await apiFetch(buildApiUrl(`/api/documents/${id}/move/`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ folder: folderId }),
  })
  if (!res.ok) throw new Error('Failed to move document')
  return res.json()
}

export async function renameDocument(
  id: number,
  name: string,
): Promise<DocumentRecord> {
  const res = await apiFetch(buildApiUrl(`/api/documents/${id}/rename/`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to rename document')
  return res.json()
}

export async function emptyTrash(): Promise<{ deleted_documents: number; deleted_folders: number }> {
  const res = await apiFetch(buildApiUrl('/api/documents/empty-trash/'), {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to empty trash')
  return res.json()
}

/* ── Helpers ── */

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}
