import { apiFetch, authHeaders, buildApiUrl } from './api'

function extractError(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const obj = body as Record<string, unknown>
  if (typeof obj.detail === 'string') return obj.detail
  for (const val of Object.values(obj)) {
    if (typeof val === 'string') return val
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
      return val[0]
    }
  }
  return ''
}

export type BookingPaymentLinkRecord = {
  id: number
  public_token: string
  status: string
  base_amount: string
  platform_fee: string
  processing_fee_estimate: string
  charge_amount: string
  currency: string
  expires_at: string
  paid_at: string | null
  paymongo_checkout_url: string
  checkout_url: string
  public_url: string
  created_at: string
}

export type BookingPaymentSummary = {
  total_amount: string
  required_downpayment_amount: string
  paid_amount: string
  paid_charge_amount: string
  paid_processing_fees: string
  paid_platform_fees: string
  paid_net_amount: string
  remaining_amount: string
  has_paid_payment: boolean
}

export type BookingPaymentRecord = {
  id: number
  amount: string
  charge_amount: string
  base_amount: string
  platform_fee: string
  processing_fee: string
  net_amount: string
  tax: string
  payment_method: string
  transaction_id: string
  transaction_status: string
  transaction_date: string | null
  created_at: string
  notes: string
}

export type BookingPaymentLinksResponse = {
  links: BookingPaymentLinkRecord[]
  payments: BookingPaymentRecord[]
  summary: BookingPaymentSummary
}

export type PublicPaymentLinkRecord = {
  token: string
  status: string
  quotation_title: string
  quotation_unique_id: string
  company_name: string
  currency: string
  currency_symbol: string
  base_amount: string
  platform_fee: string
  processing_fee_estimate: string
  charge_amount: string
  fees_total: string
  checkout_url: string
  public_url: string
  expires_at: string
  paid_at: string | null
}

export async function fetchBookingPaymentLinks(
  bookingId: number,
): Promise<BookingPaymentLinksResponse> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${bookingId}/payment-links/`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load payment links')
  return res.json()
}

export async function cancelBookingPaymentLink(
  bookingId: number,
  linkId: number,
): Promise<void> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${bookingId}/payment-links/${linkId}/`),
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  )
  if (!res.ok) {
    try {
      const body = await res.json()
      throw new Error(extractError(body) || 'Failed to cancel payment link')
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('Failed to cancel payment link')
    }
  }
}

export type ManualBookingPaymentPayload = {
  amount: string
  payment_method: 'Cash' | 'Cheque' | 'Bank Transfer'
  notes?: string
}

export async function createManualBookingPayment(
  bookingId: number,
  payload: ManualBookingPaymentPayload,
): Promise<BookingPaymentRecord> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${bookingId}/manual-payments/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    try {
      const body = await res.json()
      throw new Error(extractError(body) || 'Failed to record manual payment')
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('Failed to record manual payment')
    }
  }
  return res.json()
}

export async function createBookingPaymentLink(
  bookingId: number,
  amount: number,
): Promise<BookingPaymentLinkRecord> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${bookingId}/payment-links/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount: amount.toFixed(2) }),
    },
  )
  if (!res.ok) {
    try {
      const body = await res.json()
      throw new Error(extractError(body) || 'Failed to create payment link')
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('Failed to create payment link')
    }
  }
  return res.json()
}

export async function fetchPublicPaymentLink(
  token: string,
): Promise<PublicPaymentLinkRecord> {
  const res = await fetch(buildApiUrl(`/public/payment-links/${token}/`), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    try {
      const body = await res.json()
      throw new Error(extractError(body) || 'Payment link not found')
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('Payment link not found')
    }
  }
  return res.json()
}
