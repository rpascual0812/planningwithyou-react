import { apiFetch, authHeaders, buildApiUrl } from './api'

export type EmailRecord = {
  id: number
  to: string[]
  cc: string[]
  bcc: string[]
  email_from: string
  subject: string
  body_html: string
  body_text: string
  attachments: string[]
  status: 'queued' | 'sent' | 'failed'
  error: string
  attempts: number
  created_at: string
  sent_at: string | null
}

export type EmailPayload = {
  to?: string[]
  cc?: string[]
  bcc?: string[]
  email_from?: string
  subject?: string
  body_html?: string
  body_text?: string
  attachments?: string[]
}

export async function fetchEmails(
  search = '',
  statusFilter = '',
): Promise<EmailRecord[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (statusFilter) params.set('status', statusFilter)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await apiFetch(buildApiUrl(`/api/emails/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load emails')
  return res.json()
}

export async function fetchEmail(id: number): Promise<EmailRecord> {
  const res = await apiFetch(buildApiUrl(`/api/emails/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load email')
  return res.json()
}

export async function resendEmail(
  id: number,
  data: EmailPayload = {},
): Promise<EmailRecord> {
  const res = await apiFetch(buildApiUrl(`/api/emails/${id}/resend/`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to resend email')
  }
  return res.json()
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
