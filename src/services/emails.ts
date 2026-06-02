import { apiFetch, authHeaders, buildApiUrl, apiErrorFromResponse, readJsonResponse } from './api'

export type EmailRecord = {
  id: number
  to: string[]
  cc: string[]
  bcc: string[]
  email_from: string
  reply_to: string
  subject: string
  body: string
  attachments: string[]
  created_by: number | null
  company_id: number | null
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
  reply_to?: string
  subject?: string
  body?: string
  attachments?: string[]
}

export type EmailsPage = {
  count: number
  next: string | null
  previous: string | null
  results: EmailRecord[]
}

export async function fetchEmails(
  search = '',
  statusFilter = '',
  companyId?: number | null,
): Promise<EmailRecord[]> {
  const page = await fetchEmailsPage(1, search, statusFilter, companyId)
  return page.results
}

export async function fetchEmailsPage(
  page = 1,
  search = '',
  statusFilter = '',
  companyId?: number | null,
): Promise<EmailsPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('paginated', 'true')
  if (search) params.set('search', search)
  if (statusFilter) params.set('status', statusFilter)
  if (companyId != null) params.set('company_id', String(companyId))
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await apiFetch(buildApiUrl(`/emails/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load emails')
  return res.json()
}

/** Cross-tenant email logs for Admin → Emails. */
export async function fetchAdminEmails(
  search = '',
  statusFilter = '',
  companyId?: number | null,
): Promise<EmailRecord[]> {
  const page = await fetchAdminEmailsPage(1, search, statusFilter, companyId)
  return page.results
}

export async function fetchAdminEmailsPage(
  page = 1,
  search = '',
  statusFilter = '',
  companyId?: number | null,
): Promise<EmailsPage> {
  const params = new URLSearchParams({ platform_scope: '1' })
  params.set('page', String(page))
  params.set('paginated', 'true')
  if (search) params.set('search', search)
  if (statusFilter) params.set('status', statusFilter)
  if (companyId != null) params.set('company_id', String(companyId))

  const res = await apiFetch(buildApiUrl(`/emails/?${params.toString()}`), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load emails')
  }
  return readJsonResponse(res, 'Failed to load emails')
}

export async function fetchEmail(id: number): Promise<EmailRecord> {
  const res = await apiFetch(buildApiUrl(`/emails/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load email')
  return res.json()
}

function apiEmailBody(data: EmailPayload): EmailPayload {
  const { email_from: _, ...body } = data as EmailPayload & { email_from?: string }
  return body
}

export async function sendEmail(
  data: EmailPayload,
): Promise<EmailRecord> {
  const res = await apiFetch(buildApiUrl('/emails/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(apiEmailBody(data)),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to send email')
  }
  return res.json()
}

export async function resendEmail(
  id: number,
  data: EmailPayload = {},
): Promise<EmailRecord> {
  const res = await apiFetch(buildApiUrl(`/emails/${id}/resend/`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(apiEmailBody(data)),
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
