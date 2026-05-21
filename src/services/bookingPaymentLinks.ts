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

export type PublicPaymentLinkRecord = {
  token: string
  status: string
  booking_title: string
  booking_unique_id: string
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
): Promise<BookingPaymentLinkRecord[]> {
  const res = await apiFetch(
    buildApiUrl(`/api/booking-items/${bookingId}/payment-links/`),
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
    buildApiUrl(`/api/booking-items/${bookingId}/payment-links/${linkId}/`),
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

export async function createBookingPaymentLink(
  bookingId: number,
): Promise<BookingPaymentLinkRecord> {
  const res = await apiFetch(
    buildApiUrl(`/api/booking-items/${bookingId}/payment-links/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
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
  const res = await fetch(buildApiUrl(`/api/public/payment-links/${token}/`), {
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
