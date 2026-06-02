import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'
import type {
  SupportTicketDetailRecord,
  SupportTicketMessageRecord,
  SupportTicketRecord,
  SupportTicketStatus,
} from './supportTickets'

export type SupportTicketsPage = {
  count: number
  next: string | null
  previous: string | null
  results: SupportTicketRecord[]
}

export async function fetchAdminSupportTickets(
  search = '',
  status = '',
): Promise<SupportTicketRecord[]> {
  const page = await fetchAdminSupportTicketsPage(1, search, status)
  return page.results
}

export async function fetchAdminSupportTicketsPage(
  page = 1,
  search = '',
  status = '',
): Promise<SupportTicketsPage> {
  const params: Record<string, string> = {}
  params.page = String(page)
  if (search.trim()) params.search = search.trim()
  if (status) params.status = status
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/admin/support-tickets', params)),
    {
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load support tickets')
  }
  return readJsonResponse(res, 'Failed to load support tickets')
}

export async function fetchAdminSupportTicket(
  id: number,
): Promise<SupportTicketDetailRecord> {
  const res = await apiFetch(buildApiUrl(`/admin/support-tickets/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load support ticket')
  }
  return readJsonResponse(res, 'Failed to load support ticket')
}

export async function updateAdminSupportTicketStatus(
  id: number,
  status: SupportTicketStatus,
): Promise<SupportTicketRecord> {
  const res = await apiFetch(buildApiUrl(`/admin/support-tickets/${id}/`), {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to update ticket')
  }
  return readJsonResponse(res, 'Failed to update ticket')
}

export async function sendAdminSupportTicketMessage(
  ticketId: number,
  body: string,
): Promise<SupportTicketMessageRecord> {
  const res = await apiFetch(
    buildApiUrl(`/admin/support-tickets/${ticketId}/messages/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ body }),
    },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to send message')
  }
  return readJsonResponse(res, 'Failed to send message')
}

export async function markAdminSupportTicketRead(
  id: number,
): Promise<SupportTicketRecord> {
  const res = await apiFetch(
    buildApiUrl(`/admin/support-tickets/${id}/mark-read/`),
    {
      method: 'POST',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to update ticket')
  }
  return readJsonResponse(res, 'Failed to update ticket')
}
