import {
  apiErrorFromResponse,
  apiFetch,
  apiPathWithQuery,
  authHeaders,
  buildApiUrl,
  readJsonResponse,
} from './api'

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

export type AdminBookingPaymentsPage = {
  count: number
  next: string | null
  previous: string | null
  results: AdminBookingPaymentRecord[]
}

export async function fetchAdminBookingPayments(
  options: {
    companyId?: number | null
    payout?: 'pending' | 'sent' | ''
    search?: string
  } = {},
): Promise<AdminBookingPaymentRecord[]> {
  const page = await fetchAdminBookingPaymentsPage(1, options)
  return page.results
}

export async function fetchAdminBookingPaymentsPage(
  page = 1,
  options: {
    companyId?: number | null
    payout?: 'pending' | 'sent' | ''
    search?: string
  } = {},
): Promise<AdminBookingPaymentsPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (options.companyId != null) {
    params.set('company_id', String(options.companyId))
  }
  if (options.payout) {
    params.set('payout', options.payout)
  }
  if (options.search?.trim()) {
    params.set('search', options.search.trim())
  }
  const res = await apiFetch(
    buildApiUrl(apiPathWithQuery('/admin/booking-payments', params)),
    { headers: authHeaders() },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to load booking payments')
  }
  return readJsonResponse(res, 'Failed to load booking payments')
}

export async function markAdminBookingPayoutSent(
  paymentId: number,
): Promise<AdminBookingPaymentRecord> {
  const res = await apiFetch(
    buildApiUrl(`/admin/booking-payments/${paymentId}/mark-payout-sent/`),
    {
      method: 'POST',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    throw await apiErrorFromResponse(res, 'Failed to mark payout as sent')
  }
  return readJsonResponse(res, 'Failed to mark payout as sent')
}
