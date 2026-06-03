import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'

export type BookingPayoutRecord = {
  id: number
  quotation: number
  quotation_unique_id?: string
  quotation_title?: string
  quotation_credit?: string
  /** @deprecated API may still return these before deploy */
  booking?: number
  booking_unique_id?: string
  booking_title?: string
  booking_credit?: string
  payment_method: string
  notes: string
  transaction_id: string
  transaction_status: string
  transaction_date: string | null
  payout_sent_at: string | null
  payout_sent: boolean
  created_at: string
}

export type BookingPayoutsPage = {
  count: number
  next: string | null
  previous: string | null
  results: BookingPayoutRecord[]
}

export async function fetchBookingPayouts(
  options: {
    payout?: 'pending' | 'sent' | ''
    search?: string
  } = {},
): Promise<BookingPayoutRecord[]> {
  const params = new URLSearchParams()
  if (options.payout) {
    params.set('payout', options.payout)
  }
  if (options.search?.trim()) {
    params.set('search', options.search.trim())
  }
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/booking-payouts', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load payouts')
  }
  return readJsonResponse(res, 'Failed to load payouts')
}

export async function fetchBookingPayoutsPage(
  page = 1,
  options: {
    payout?: 'pending' | 'sent' | ''
    search?: string
  } = {},
): Promise<BookingPayoutsPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('paginated', 'true')
  if (options.payout) params.set('payout', options.payout)
  if (options.search?.trim()) params.set('search', options.search.trim())
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/booking-payouts', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load payouts')
  }
  return readJsonResponse(res, 'Failed to load payouts')
}
