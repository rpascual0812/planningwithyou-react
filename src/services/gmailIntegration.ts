import { apiFetch, authHeaders, buildApiUrl } from './api'

export type GmailIntegrationStatus = {
  connected: boolean
  configured: boolean
  google_email: string
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

export async function fetchGmailIntegration(): Promise<GmailIntegrationStatus> {
  const res = await apiFetch(buildApiUrl('/email-integrations/gmail/'), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to load Gmail integration')
  }
  return res.json()
}

export async function startGmailConnect(): Promise<GmailIntegrationStatus> {
  const res = await apiFetch(buildApiUrl('/email-integrations/gmail/'), {
    method: 'PUT',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to start Gmail connection')
  }
  return res.json()
}

export async function disconnectGmail(): Promise<GmailIntegrationStatus> {
  const res = await apiFetch(buildApiUrl('/email-integrations/gmail/'), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await integrationApiError(res, 'Failed to disconnect Gmail')
  }
  return res.json()
}
