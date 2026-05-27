import {
  apiErrorFromResponse,
  apiFetch,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export type SupportTicketMessageRecord = {
  id: number
  body: string
  is_staff: boolean
  created_by: number
  created_by_name: string
  created_at: string
  is_mine: boolean
}

export type SupportTicketRecord = {
  id: number
  title: string
  status: SupportTicketStatus
  created_by: number
  created_by_name: string
  created_at: string
  is_read: boolean
  can_delete: boolean
  message_count: number
  last_message_preview: string
  last_message_at: string
}

export type SupportTicketDetailRecord = SupportTicketRecord & {
  messages: SupportTicketMessageRecord[]
}

export type SupportTicketPayload = {
  title: string
  message: string
}

export async function fetchSupportTickets(): Promise<SupportTicketRecord[]> {
  const res = await apiFetch(buildApiUrl('/support-tickets/'), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load support tickets')
  }
  return readJsonResponse(res, 'Failed to load support tickets')
}

export async function fetchSupportTicket(
  id: number,
): Promise<SupportTicketDetailRecord> {
  const res = await apiFetch(buildApiUrl(`/support-tickets/${id}/`), {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load support ticket')
  }
  return readJsonResponse(res, 'Failed to load support ticket')
}

export async function createSupportTicket(
  payload: SupportTicketPayload,
): Promise<SupportTicketDetailRecord> {
  const res = await apiFetch(buildApiUrl('/support-tickets/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to create support ticket')
  }
  return readJsonResponse(res, 'Failed to create support ticket')
}

export async function deleteSupportTicket(id: number): Promise<void> {
  const res = await apiFetch(buildApiUrl(`/support-tickets/${id}/`), {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to delete support ticket')
  }
}

export async function sendSupportTicketMessage(
  ticketId: number,
  body: string,
): Promise<SupportTicketMessageRecord> {
  const res = await apiFetch(
    buildApiUrl(`/support-tickets/${ticketId}/messages/`),
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

export async function markSupportTicketRead(
  id: number,
): Promise<SupportTicketRecord> {
  const res = await apiFetch(buildApiUrl(`/support-tickets/${id}/mark-read/`), {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to update ticket')
  }
  return readJsonResponse(res, 'Failed to update ticket')
}

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}
