import { apiFetch, authHeaders, buildApiUrl } from './api'
import type { BookingsView } from '../utils/bookingsView'

export type BookingViewConfigRecord = {
  scope: string
  name: string
  value: BookingsView
}

export async function fetchBookingViewConfig(): Promise<BookingViewConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/booking-view/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load quotation view setting')
  return res.json()
}

export async function saveBookingViewConfig(
  value: BookingsView,
): Promise<BookingViewConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/booking-view/'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error('Failed to save quotation view setting')
  return res.json()
}

export type BookingsGroupNameConfigRecord = {
  scope: string
  name: string
  value: string
}

export async function fetchBookingsGroupNameConfig(): Promise<BookingsGroupNameConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/bookings-group-name/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load quotations group name')
  return res.json()
}

export async function saveBookingsGroupNameConfig(
  value: string,
): Promise<BookingsGroupNameConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/bookings-group-name/'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error('Failed to save quotations group name')
  return res.json()
}

export type ProfitProgressTagConfigRecord = {
  scope: string
  name: string
  company_id: number
  value: string
}

export async function fetchProfitProgressTagConfig(
  companyId: number,
): Promise<ProfitProgressTagConfigRecord> {
  const res = await apiFetch(
    buildApiUrl(`/config/profit-progress-tag/?company_id=${companyId}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load profit progress tag setting')
  return res.json()
}

export async function saveProfitProgressTagConfig(
  companyId: number,
  tagId: number | null,
): Promise<ProfitProgressTagConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/profit-progress-tag/'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      company_id: companyId,
      value: tagId != null ? String(tagId) : '',
    }),
  })
  if (!res.ok) throw new Error('Failed to save profit progress tag setting')
  return res.json()
}

export type ActiveProjectsTagConfigRecord = ProfitProgressTagConfigRecord

export async function fetchActiveProjectsTagConfig(
  companyId: number,
): Promise<ActiveProjectsTagConfigRecord> {
  const res = await apiFetch(
    buildApiUrl(`/config/active-projects-tag/?company_id=${companyId}`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load active projects tag setting')
  return res.json()
}

export async function saveActiveProjectsTagConfig(
  companyId: number,
  tagId: number | null,
): Promise<ActiveProjectsTagConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/active-projects-tag/'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      company_id: companyId,
      value: tagId != null ? String(tagId) : '',
    }),
  })
  if (!res.ok) throw new Error('Failed to save active projects tag setting')
  return res.json()
}
