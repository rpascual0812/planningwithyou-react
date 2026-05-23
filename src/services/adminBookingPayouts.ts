import { apiFetch, authHeaders, buildApiUrl } from './api'

export type AdminBookingPaymentRecord = {
  id: number
  company: number
  company_name: string
  booking: number
  booking_unique_id: string
  booking_title: string
  base_amount: string
  platform_fee: string
  processing_fee: string
  net_amount: string
  charge_amount: string
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

async function adminPayoutApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    return new Error(extractError(body) || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchAdminBookingPayments(
  options: {
    companyId?: number | null
    payout?: 'pending' | 'sent' | ''
    search?: string
  } = {},
): Promise<AdminBookingPaymentRecord[]> {
  const params = new URLSearchParams()
  if (options.companyId != null) {
    params.set('company_id', String(options.companyId))
  }
  if (options.payout) {
    params.set('payout', options.payout)
  }
  if (options.search?.trim()) {
    params.set('search', options.search.trim())
  }
  const qs = params.toString()
  const res = await apiFetch(
    buildApiUrl(`/api/admin/booking-payments/${qs ? `?${qs}` : ''}`),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await adminPayoutApiError(res, 'Failed to load booking payments')
  }
  return res.json()
}

export async function markAdminBookingPayoutSent(
  paymentId: number,
): Promise<AdminBookingPaymentRecord> {
  const res = await apiFetch(
    buildApiUrl(`/api/admin/booking-payments/${paymentId}/mark-payout-sent/`),
    {
      method: 'POST',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await adminPayoutApiError(res, 'Failed to mark payout as sent')
  }
  return res.json()
}
