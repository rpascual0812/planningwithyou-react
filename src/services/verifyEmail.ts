import { apiFetch, buildApiUrl } from './api'
import { persistTokens } from './auth'

type VerifyEmailResponse = {
  access: string
  refresh?: string
  detail?: string
}

function getErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return 'Verification failed. Please try again.'
  }
  const body = data as Record<string, unknown>
  const detail = body.detail ?? body.token
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && typeof detail[0] === 'string') return detail[0]
  return 'Verification failed. Please try again.'
}

export async function verifyEmailToken(
  token: string,
  remember = true,
): Promise<VerifyEmailResponse> {
  const res = await apiFetch(buildApiUrl('/api/verify-email/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ token }),
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

  const tokens = data as Partial<VerifyEmailResponse>
  if (!tokens.access) {
    throw new Error('Verification succeeded but no access token was returned.')
  }

  persistTokens(
    { access: tokens.access, refresh: tokens.refresh },
    remember,
  )

  return data as VerifyEmailResponse
}
