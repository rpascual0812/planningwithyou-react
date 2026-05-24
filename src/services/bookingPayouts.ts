import { apiFetch, authHeaders, buildApiUrl } from './api'

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

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0]
  }
  return ''
}

async function payoutApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
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
  const qs = params.toString()
  const res = await apiFetch(
    buildApiUrl(`/api/booking-payouts/${qs ? `?${qs}` : ''}`),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await payoutApiError(res, 'Failed to load payouts')
  }
  return res.json()
}
