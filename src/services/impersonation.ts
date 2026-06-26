import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'
import {
  getRefreshToken,
  persistTokens,
  restoreAdminSessionFromImpersonation,
  saveAdminSessionForImpersonation,
} from './auth'

export type ImpersonationUserRecord = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  account: number | null
  account_name: string
  company: number | null
  company_name: string
  is_active: boolean
  can_impersonate: boolean
}

type ImpersonationStartResponse = {
  access: string
  refresh: string
  impersonation_log_id: number
  target_user_id: number
}

export async function fetchImpersonationUsers(
  accountId: number,
  companyId?: number,
): Promise<ImpersonationUserRecord[]> {
  const params = new URLSearchParams()
  params.set('account_id', String(accountId))
  if (companyId != null) {
    params.set('company_id', String(companyId))
  }
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/admin/impersonation-users/', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load users')
  }
  return readJsonResponse(res, 'Failed to load users')
}

export async function startImpersonation(userId: number): Promise<void> {
  saveAdminSessionForImpersonation()
  try {
    const res = await apiFetch(buildApiUrl('/admin/impersonate/'), {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    })
    if (!res.ok) {
      throw await apiErrorFromResponse(res, 'Failed to start impersonation')
    }
    const data = await readJsonResponse<ImpersonationStartResponse>(
      res,
      'Failed to start impersonation',
    )
    persistTokens({ access: data.access, refresh: data.refresh }, true)
  } catch (err) {
    restoreAdminSessionFromImpersonation()
    throw err
  }
}

export async function endImpersonation(): Promise<void> {
  const refresh = getRefreshToken()
  if (refresh) {
    try {
      await apiFetch(buildApiUrl('/admin/impersonate/end/'), {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh }),
      })
    } catch {
      // Still restore the admin session locally.
    }
  }
  restoreAdminSessionFromImpersonation()
}
