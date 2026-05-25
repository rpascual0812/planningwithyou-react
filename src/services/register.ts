import { apiFetch, buildApiUrl } from './api'
import { persistTokens } from './auth'

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

type RegisterResponse = {
  access: string
  refresh?: string
  account_id: number
  company_id: number
  user_id: number
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
  remember = true,
): Promise<RegisterResponse> {
  const res = await apiFetch(buildApiUrl('/api/register/'), {
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

  const tokens = data as Partial<RegisterResponse>
  if (!tokens.access) {
    throw new Error('Registration succeeded but no access token was returned.')
  }

  persistTokens(
    { access: tokens.access, refresh: tokens.refresh },
    remember,
  )

  return data as RegisterResponse
}
