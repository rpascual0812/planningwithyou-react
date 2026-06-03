import { apiFetch, authHeaders, buildApiUrl } from './api'

const BASE = '/email-templates/quotations/'

export type EmailBookingTemplateRecord = {
  id: number
  name: string
  title: string
  cc: string[]
  bcc: string[]
  subject: string
  body: string
  type: 'quotations'
  is_active: boolean
  is_default: boolean
  company_id: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type EmailBookingTemplatePayload = {
  name: string
  title: string
  cc?: string[]
  bcc?: string[]
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

/** Default system template for a company (e.g. ``payment_link``). */
export function findCompanyDefaultBookingTemplate(
  templates: EmailBookingTemplateRecord[],
  name: string,
  companyId: number,
): EmailBookingTemplateRecord | undefined {
  return templates.find(
    (t) =>
      t.name === name &&
      t.is_default &&
      t.is_active &&
      t.company_id === companyId,
  )
}

export async function fetchEmailBookingTemplates(
  search = '',
  companyId?: number | null,
): Promise<EmailBookingTemplateRecord[]> {
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

export async function createEmailBookingTemplate(
  data: EmailBookingTemplatePayload,
): Promise<EmailBookingTemplateRecord> {
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

export async function updateEmailBookingTemplate(
  id: number,
  data: Partial<EmailBookingTemplatePayload>,
): Promise<EmailBookingTemplateRecord> {
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

export async function deleteEmailBookingTemplate(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete template')
}
