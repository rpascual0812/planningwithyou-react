import { apiFetch, buildApiUrl } from './api'

export type RegisterPayload = {
  company_name: string
  supplier_type_id: number
  first_name: string
  last_name: string
  email: string
  mobile_number: string
  phone_number?: string
  password: string
}

export type RegisterResponse = {
  detail: string
  email: string
}

function getErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return 'Registration failed. Please try again.'
  }
  const body = data as Record<string, unknown>
  const detail = body.detail ?? body.non_field_errors
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && typeof detail[0] === 'string') return detail[0]
  if (typeof body === 'object') {
    for (const value of Object.values(body)) {
      if (typeof value === 'string') return value
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
    }
  }
  return 'Registration failed. Please try again.'
}

export async function registerAccount(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  const res = await apiFetch(buildApiUrl('/register/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(getErrorMessage(data))
  }

  return data as RegisterResponse
}
