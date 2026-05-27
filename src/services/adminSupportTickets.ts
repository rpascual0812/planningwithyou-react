import {
  apiErrorFromResponse,
  apiFetch,
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

export async function fetchAdminSupportTickets(): Promise<SupportTicketRecord[]> {
  const res = await apiFetch(buildApiUrl('/admin/support-tickets/'), {
    headers: authHeaders(),
  })
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
