import { buildApiUrl } from './api'
import type { WeddingTemplateDocument } from '../features/template-studio/types/schema'

export type TemplateStudioRecord = {
  id: number
  title: string
  slug: string
  category: string
  description: string
  document: WeddingTemplateDocument
  is_published: boolean
  published_at: string | null
  is_marketplace: boolean
  marketplace_preview_url: string
  company_id: number | null
  created_by_name: string
  created_at: string
  updated_at: string
}

export type MarketplaceTemplateRecord = {
  id: number
  title: string
  slug: string
  category: string
  description: string
  marketplace_preview_url: string
  document: WeddingTemplateDocument
}

export type TemplateAssetRecord = {
  id: number
  uuid: string
  url: string
  original_name: string
  mime_type: string
  size: number
}

export type PublicInvitationRecord = {
  title: string
  slug: string
  category: string
  description: string
  document: WeddingTemplateDocument
  company_name: string
  published_at: string | null
}

const BASE = '/template-studio/templates/'

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  const parts: string[] = []
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'detail' && typeof val === 'string') return val
    if (typeof val === 'string') parts.push(`${key}: ${val}`)
    if (Array.isArray(val) && typeof val[0] === 'string') {
      parts.push(key === 'non_field_errors' ? val[0] : `${key}: ${val[0]}`)
    }
  }
  return parts[0] ?? ''
}

export async function fetchTemplateStudioList(): Promise<TemplateStudioRecord[]> {
  const { apiFetch, authHeaders } = await import('./api')
  const res = await apiFetch(buildApiUrl(BASE), { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json()
}

export async function fetchTemplateStudio(id: number): Promise<TemplateStudioRecord> {
  const { apiFetch, authHeaders } = await import('./api')
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load template')
  return res.json()
}

export type SaveTemplatePayload = {
  title: string
  description?: string
  category?: string
  document: WeddingTemplateDocument
}

export async function saveTemplateStudio(
  payload: SaveTemplatePayload,
  id?: number,
): Promise<TemplateStudioRecord> {
  const { apiFetch, authHeaders } = await import('./api')
  const url = id ? `${BASE}${id}/` : BASE
  const res = await apiFetch(buildApiUrl(url), {
    method: id ? 'PATCH' : 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to save template')
  }
  return res.json()
}

export async function publishTemplateStudio(
  id: number,
  payload?: SaveTemplatePayload,
): Promise<TemplateStudioRecord> {
  const { apiFetch, authHeaders } = await import('./api')
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/publish/`), {
    method: 'POST',
    headers: authHeaders(),
    body: payload ? JSON.stringify(payload) : undefined,
  })
  if (!res.ok) throw new Error('Failed to publish template')
  return res.json()
}

export async function unpublishTemplateStudio(id: number): Promise<TemplateStudioRecord> {
  const { apiFetch, authHeaders } = await import('./api')
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/unpublish/`), {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to unpublish template')
  return res.json()
}

export async function duplicateTemplateStudio(id: number): Promise<TemplateStudioRecord> {
  const { apiFetch, authHeaders } = await import('./api')
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/duplicate/`), {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to duplicate template')
  return res.json()
}

export async function deleteTemplateStudio(id: number): Promise<void> {
  const { apiFetch, authHeaders } = await import('./api')
  const res = await apiFetch(buildApiUrl(`${BASE}${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete template')
}

export async function fetchMarketplaceTemplates(
  category?: string,
): Promise<MarketplaceTemplateRecord[]> {
  const { apiFetch, authHeaders } = await import('./api')
  const params = category ? `?category=${encodeURIComponent(category)}` : ''
  const res = await apiFetch(buildApiUrl(`/template-studio/marketplace/${params}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load marketplace')
  return res.json()
}

export async function uploadTemplateImage(file: File): Promise<TemplateAssetRecord> {
  const { apiFetch } = await import('./api')
  const { getAccessToken } = await import('./auth')
  const formData = new FormData()
  formData.append('file', file)
  const token = getAccessToken()
  const res = await apiFetch(buildApiUrl('/template-studio/assets/upload/'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to upload image')
  }
  return res.json()
}

export async function fetchPublicInvitation(slug: string): Promise<PublicInvitationRecord> {
  const res = await fetch(buildApiUrl(`/public/invitations/${slug}/`), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Invitation not found')
  return res.json()
}

export type SubmitRsvpPayload = {
  element_id: string
  fields: Record<string, string>
}

export type SubmitRsvpResult = {
  id: number
  success_message: string
}

export class RsvpSubmitError extends Error {
  fieldErrors?: Record<string, string>

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'RsvpSubmitError'
    this.fieldErrors = fieldErrors
  }
}

export async function submitPublicRsvp(
  slug: string,
  payload: SubmitRsvpPayload,
): Promise<SubmitRsvpResult> {
  const res = await fetch(buildApiUrl(`/public/invitations/${slug}/rsvp/`), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const fieldErrors =
      body && typeof body === 'object' && body.fields && typeof body.fields === 'object'
        ? (body.fields as Record<string, string>)
        : undefined
    throw new RsvpSubmitError(extractError(body) || 'Failed to submit RSVP', fieldErrors)
  }
  return body as SubmitRsvpResult
}

export type PublicRsvpFieldColumn = {
  id: string
  label: string
}

export type PublicRsvpRecord = {
  id: number
  element_id: string
  fields_data: Record<string, string>
  created_at: string
}

export type PublicRsvpBreakdownItem = {
  key: 'will_go' | 'will_not_go' | 'awaiting_reply'
  label: string
  count: number
  percent: number
}

export type PublicRsvpAnalytics = {
  total_views: number
  expected_visitors: number
  days_remaining: number | null
  will_go: number
  will_not_go: number
  awaiting_reply: number
  total_guests: number
  breakdown: PublicRsvpBreakdownItem[]
}

export type PublicRsvpListResponse = {
  title: string
  slug: string
  field_columns: PublicRsvpFieldColumn[]
  analytics: PublicRsvpAnalytics
  results: PublicRsvpRecord[]
}

export async function fetchPublicRsvpList(slug: string): Promise<PublicRsvpListResponse> {
  const res = await fetch(buildApiUrl(`/public/invitations/${slug}/rsvp/`), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('RSVP list not found')
  return res.json()
}

export function getPublicRsvpExportUrl(slug: string): string {
  return buildApiUrl(`/public/invitations/${slug}/rsvp/export/`)
}
