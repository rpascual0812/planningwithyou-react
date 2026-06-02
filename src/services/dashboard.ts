import { apiFetch, authHeaders, buildApiUrl } from './api'

export type DashboardUpcomingBooking = {
  id: number
  unique_id: string
  title: string
  date_of_event: string | null
}

export type DashboardStatusCount = {
  status_id: number
  title: string
  color: string
  count: number
}

export type DashboardCompanySummary = {
  id: number
  name: string
  is_main: boolean
  kyb_verified: boolean
  is_user_company: boolean
  bookings_owned: {
    count: number
    by_status: DashboardStatusCount[]
    total_amount: string
    paid_amount: string
    remaining_amount: string
    downpayment_required: string
    outstanding_booking_count: number
    downpayment_due_count: number
    upcoming: DashboardUpcomingBooking[]
  }
  bookings_as_supplier: {
    count: number
    upcoming: DashboardUpcomingBooking[]
  }
  payouts: {
    pending_count: number
    pending_amount: string
    sent_count: number
    sent_amount: string
  }
  calendar: {
    events_this_week: number
    upcoming_count: number
  }
  failed_payment_count: number
}

export type DashboardSummary = {
  generated_at: string
  companies: DashboardCompanySummary[]
}

export type DashboardProfitProgress = {
  tag_id: number | null
  tag_name: string
  total_amount: string
  display_value: string
}

export async function fetchDashboardProfitProgress(): Promise<DashboardProfitProgress> {
  const res = await apiFetch(buildApiUrl('/dashboard/profit-progress/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load profit progress')
  return res.json()
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiFetch(buildApiUrl('/dashboard/summary/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load dashboard')
  return res.json()
}
