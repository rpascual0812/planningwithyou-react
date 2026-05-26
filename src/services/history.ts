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
  account: (id: number) => `/api/accounts/${id}/history/`,
  company: (id: number) => `/api/companies/${id}/history/`,
  user: (id: number) => `/api/users/${id}/history/`,
  contact: (id: number) => `/api/contacts/${id}/history/`,
  bookingStatus: (id: number) => `/api/booking-statuses/${id}/history/`,
  bookingItem: (id: number) => `/api/booking-items/${id}/history/`,
  formTemplate: (id: number) => `/api/form-templates/${id}/history/`,
  emailTemplateUsers: (id: number) => `/api/email-templates/users/${id}/history/`,
  emailTemplateBookings: (id: number) => `/api/email-templates/bookings/${id}/history/`,
  supplierSetting: (companyId: number) =>
    `/api/companies/${companyId}/supplier-setting/history/`,
} as const
