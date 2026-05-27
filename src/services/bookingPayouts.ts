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
  booking: number
  booking_unique_id: string
  booking_title: string
  booking_credit: string
  payment_method: string
  transaction_id: string
  transaction_status: string
  transaction_date: string | null
  payout_sent_at: string | null
  payout_sent: boolean
  created_at: string
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
