import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'

export type AdminErrorLogRecord = {
  id: number
  method: string
  path: string
  query_string: string
  status_code: number | null
  exception_type: string
  exception_message: string
  user: number | null
  user_email: string | null
  account: number | null
  account_name: string | null
  ip_address: string | null
  created_at: string
  resolved_at: string | null
  is_resolved: boolean
}

export type AdminErrorLogDetailRecord = AdminErrorLogRecord & {
  traceback: string
  request_body: string
  user_agent: string
}

export type AdminErrorLogFilters = {
  search?: string
  method?: string
  status_code?: string
  occurred_from?: string
  occurred_to?: string
}

export type AdminErrorLogPage = {
  count: number
  next: string | null
  previous: string | null
  results: AdminErrorLogRecord[]
}

export async function fetchAdminErrorLogs(
  filters: AdminErrorLogFilters = {},
  page = 1,
): Promise<AdminErrorLogPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.method?.trim()) params.set('method', filters.method.trim())
  if (filters.status_code?.trim()) params.set('status_code', filters.status_code.trim())
  if (filters.occurred_from?.trim()) {
    params.set('occurred_from', filters.occurred_from.trim())
  }
  if (filters.occurred_to?.trim()) {
    params.set('occurred_to', filters.occurred_to.trim())
  }
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/admin/error-logs/', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load error logs')
  }
  return readJsonResponse(res, 'Failed to load error logs')
}

export async function resolveAdminErrorLog(
  id: number,
): Promise<AdminErrorLogRecord> {
  const res = await apiFetch(buildApiUrl(`/admin/error-logs/${id}/resolve/`), {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to mark error as resolved')
  }
  return readJsonResponse(res, 'Failed to mark error as resolved')
}

export async function fetchAdminErrorLog(
  id: number,
): Promise<AdminErrorLogDetailRecord> {
  const res = await apiFetch(buildApiUrl(`/admin/error-logs/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load error log')
  }
  return readJsonResponse(res, 'Failed to load error log')
}
