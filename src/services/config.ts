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
  if (!res.ok) throw new Error('Failed to load booking view setting')
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
  if (!res.ok) throw new Error('Failed to save booking view setting')
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
  if (!res.ok) throw new Error('Failed to load bookings group name')
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
  if (!res.ok) throw new Error('Failed to save bookings group name')
  return res.json()
}

export type ProfitProgressTagConfigRecord = {
  scope: string
  name: string
  value: string
}

export async function fetchProfitProgressTagConfig(): Promise<ProfitProgressTagConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/profit-progress-tag/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load profit progress tag setting')
  return res.json()
}

export async function saveProfitProgressTagConfig(
  tagId: number | null,
): Promise<ProfitProgressTagConfigRecord> {
  const res = await apiFetch(buildApiUrl('/config/profit-progress-tag/'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ value: tagId != null ? String(tagId) : '' }),
  })
  if (!res.ok) throw new Error('Failed to save profit progress tag setting')
  return res.json()
}
