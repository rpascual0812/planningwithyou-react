import { apiFetch, authHeaders, buildApiUrl } from './api'

export type GoogleCalendarIntegrationStatus = {
  connected: boolean
  configured: boolean
  google_email: string
  sync_mode: 'one_way' | 'two_way'
  two_way_sync: boolean
  last_synced_at: string | null
  authorization_url?: string | null
}

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  return ''
}

async function integrationApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchGoogleCalendarIntegration(): Promise<GoogleCalendarIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl('/calendar-integrations/google/'),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to load Google Calendar integration')
  }
  return res.json()
}

export async function startGoogleCalendarConnect(options?: {
  twoWaySync?: boolean
}): Promise<GoogleCalendarIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl('/calendar-integrations/google/'),
    {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        two_way_sync: options?.twoWaySync ?? false,
      }),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to start Google Calendar connection')
  }
  return res.json()
}

export async function updateGoogleCalendarSyncMode(
  twoWaySync: boolean,
): Promise<GoogleCalendarIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl('/calendar-integrations/google/'),
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ two_way_sync: twoWaySync }),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to update sync settings')
  }
  return res.json()
}

export async function syncGoogleCalendar(): Promise<GoogleCalendarIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl('/calendar-integrations/google/sync/'),
    {
      method: 'POST',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to sync Google Calendar')
  }
  return res.json()
}

export async function disconnectGoogleCalendar(): Promise<GoogleCalendarIntegrationStatus> {
  const res = await apiFetch(
    buildApiUrl('/calendar-integrations/google/'),
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to disconnect Google Calendar')
  }
  return res.json()
}

export function formatLastSynced(iso: string | null): string {
  if (!iso) return 'Never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
