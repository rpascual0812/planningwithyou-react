import { apiFetch, authHeaders, buildApiUrl } from './api'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'checkbox'
  | 'email'
  | 'phone'
  | 'supplier'

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'supplier', label: 'Supplier' },
]

export type FieldOption = {
  id?: number
  label: string
  price: string | null
  sort_order: number
}

export type TemplateField = {
  id?: number
  label: string
  field_type: FieldType
  is_required: boolean
  options: FieldOption[]
  price: string | null
  sort_order: number
}

export type FormTemplateRecord = {
  id: number
  name: string
  description: string
  is_active: boolean
  is_default: boolean
  company_id: number | null
  fields: TemplateField[]
  created_at: string
  updated_at: string
}

export type FormTemplateWritePayload = {
  name: string
  description: string
  is_active: boolean
  is_default: boolean
  fields: Omit<TemplateField, 'id'>[]
}

/** Form editor / API write shape (company is set server-side from the signed-in user). */
export type FormTemplatePayload = FormTemplateWritePayload

export async function fetchFormTemplates(
  companyId?: number | null,
): Promise<FormTemplateRecord[]> {
  const params = new URLSearchParams()
  if (companyId != null) params.set('company_id', String(companyId))
  const query = params.toString()
  const url = query ? `/form-templates/?${query}` : '/form-templates/'
  const res = await apiFetch(buildApiUrl(url), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load form templates')
  return res.json()
}

export async function createFormTemplate(
  data: FormTemplateWritePayload,
): Promise<FormTemplateRecord> {
  const res = await apiFetch(buildApiUrl('/form-templates/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to create form template')
  }
  return res.json()
}

export async function updateFormTemplate(
  id: number,
  data: Partial<FormTemplateWritePayload>,
): Promise<FormTemplateRecord> {
  const res = await apiFetch(buildApiUrl(`/form-templates/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(extractError(body) || 'Failed to update form template')
  }
  return res.json()
}

export async function deleteFormTemplate(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/form-templates/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to delete form template')
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
