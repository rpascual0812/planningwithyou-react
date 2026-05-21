import { apiFetch, authHeaders, buildApiUrl } from './api'

const BASE = '/api/email-templates/users/'

export type EmailUserTemplateRecord = {
  id: number
  name: string
  title: string
  subject: string
  body: string
  type: 'users'
  is_active: boolean
  is_default: boolean
  company_id: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type EmailUserTemplatePayload = {
  name: string
  title: string
  subject: string
  body: string
  is_active: boolean
  company_id?: number | null
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

export async function fetchEmailUserTemplates(
  search = '',
  companyId?: number | null,
): Promise<EmailUserTemplateRecord[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (companyId != null) params.set('company_id', String(companyId))
  const qs = params.toString()
  const res = await apiFetch(buildApiUrl(`${BASE}${qs ? `?${qs}` : ''}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load email templates')
  return res.json()
}

export async function createEmailUserTemplate(
  data: EmailUserTemplatePayload,
): Promise<EmailUserTemplateRecord> {
  const res = await apiFetch(buildApiUrl(BASE), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to create template')
  }
  return res.json()
}

export async function updateEmailUserTemplate(
  id: number,
  data: Partial<EmailUserTemplatePayload>,
): Promise<EmailUserTemplateRecord> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to update template')
  }
  return res.json()
}

export async function deleteEmailUserTemplate(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete template')
}
