import { apiFetch, authHeaders, buildApiUrl } from './api'

export type HistoryRecord = {
  id: number
  resource_type: string
  resource_id: number
  booking_id: number | null
  entity_type: string
  entity_id: number | null
  action: 'create' | 'update' | 'delete' | 'replace'
  actor_id: number | null
  actor_name: string
  changes: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
}

export async function fetchHistory(historyPath: string): Promise<HistoryRecord[]> {
  const res = await apiFetch(buildApiUrl(historyPath), { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to load history')
  return res.json()
}

export const historyPaths = {
  account: (id: number) => `/accounts/${id}/history/`,
  company: (id: number) => `/companies/${id}/history/`,
  user: (id: number) => `/users/${id}/history/`,
  contact: (id: number) => `/contacts/${id}/history/`,
  bookingStatus: (id: number) => `/booking-statuses/${id}/history/`,
  bookingItem: (id: number) => `/booking-items/${id}/history/`,
  formTemplate: (id: number) => `/form-templates/${id}/history/`,
  emailTemplateUsers: (id: number) => `/email-templates/users/${id}/history/`,
  emailTemplateBookings: (id: number) => `/email-templates/bookings/${id}/history/`,
  emailTemplateCalendar: (id: number) => `/email-templates/calendar/${id}/history/`,
  supplierSetting: (companyId: number) =>
    `/companies/${companyId}/supplier-setting/history/`,
} as const
