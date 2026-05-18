import { apiFetch, authHeaders, buildApiUrl } from './api'
import type { BookingsView } from '../utils/bookingsView'

export type BookingViewConfigRecord = {
  scope: string
  name: string
  value: BookingsView
}

export async function fetchBookingViewConfig(): Promise<BookingViewConfigRecord> {
  const res = await apiFetch(buildApiUrl('/api/config/booking-view/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load booking view setting')
  return res.json()
}

export async function saveBookingViewConfig(
  value: BookingsView,
): Promise<BookingViewConfigRecord> {
  const res = await apiFetch(buildApiUrl('/api/config/booking-view/'), {
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
  const res = await apiFetch(buildApiUrl('/api/config/bookings-group-name/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load bookings group name')
  return res.json()
}

export async function saveBookingsGroupNameConfig(
  value: string,
): Promise<BookingsGroupNameConfigRecord> {
  const res = await apiFetch(buildApiUrl('/api/config/bookings-group-name/'), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error('Failed to save bookings group name')
  return res.json()
}
