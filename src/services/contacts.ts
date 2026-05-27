import { apiFetch, authHeaders, buildApiUrl } from './api'

export type PhoneNumber = {
  id?: number
  number: string
  label: 'mobile' | 'home' | 'work' | 'other'
  is_default: boolean
}

export type Address = {
  id?: number
  label: 'home' | 'work' | 'other'
  street: string
  city: string
  state: string
  zip_code: string
  country: string
  is_default: boolean
}

export type ContactRecord = {
  id: number
  first_name: string
  last_name: string
  email: string
  company: string
  company_id: number
  company_name: string
  notes: string
  phone_numbers: PhoneNumber[]
  addresses: Address[]
  created_at: string
  updated_at: string
}

export type ContactPayload = {
  first_name: string
  last_name: string
  email: string
  company: string
  company_id: number | null
  notes: string
  phone_numbers: PhoneNumber[]
  addresses: Address[]
}

export async function fetchContacts(search = ''): Promise<ContactRecord[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  const res = await apiFetch(buildApiUrl(`/contacts/${qs}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load contacts')
  return res.json()
}

export async function fetchContact(id: number): Promise<ContactRecord> {
  const res = await apiFetch(buildApiUrl(`/contacts/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load contact')
  return res.json()
}

export async function createContact(
  data: ContactPayload,
): Promise<ContactRecord> {
  const res = await apiFetch(buildApiUrl('/contacts/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to create contact')
  }
  return res.json()
}

export async function updateContact(
  id: number,
  data: Partial<ContactPayload>,
): Promise<ContactRecord> {
  const res = await apiFetch(buildApiUrl(`/contacts/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to update contact')
  }
  return res.json()
}

export async function deleteContact(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/contacts/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete contact')
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
