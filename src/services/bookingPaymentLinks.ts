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

async function readJsonResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    if (!res.ok) throw new Error(fallbackError)
    return {} as T
  }
  try {
    return JSON.parse(text) as T
  } catch {
    if (!res.ok) {
      throw new Error(fallbackError)
    }
    throw new Error('Unexpected response from the server.')
  }
}

const PAY_SUCCESS_SESSION_KEY = (token: string) => `pwu:pay-success:${token}`

export function hasPaySuccessSession(token: string): boolean {
  try {
    return sessionStorage.getItem(PAY_SUCCESS_SESSION_KEY(token)) === '1'
  } catch {
    return false
  }
}

export function markPaySuccessSession(token: string): void {
  try {
    sessionStorage.setItem(PAY_SUCCESS_SESSION_KEY(token), '1')
  } catch {
    /* ignore private browsing / storage limits */
  }
}

export type VerifiedPaymentProvider = {
  provider: 'paymongo' | 'xendit'
  label: string
}

export type BookingPaymentLinkRecord = {
  id: number
  public_token: string
  status: string
  payment_provider?: 'paymongo' | 'xendit'
  payment_provider_label?: string
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
  refunded_amount: string
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
  verified_payment_providers: VerifiedPaymentProvider[]
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
  /** ``refund`` posts to manual-payments (works before manual-refunds route is deployed). */
  kind?: 'payment' | 'refund'
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

export async function createManualBookingRefund(
  bookingId: number,
  payload: ManualBookingPaymentPayload,
): Promise<BookingPaymentRecord> {
  const body = { ...payload, kind: 'refund' as const }
  const paymentUrl = buildApiUrl(
    `/quotation-items/${bookingId}/manual-payments/`,
  )
  const refundUrl = buildApiUrl(
    `/quotation-items/${bookingId}/manual-refunds/`,
  )
  let res = await apiFetch(paymentUrl, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (res.status === 404) {
    const { kind: _kind, ...legacyBody } = body
    res = await apiFetch(refundUrl, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(legacyBody),
    })
  }
  if (!res.ok) {
    try {
      const errBody = await res.json()
      throw new Error(extractError(errBody) || 'Failed to record refund')
    } catch (e) {
      if (e instanceof Error) throw e
      throw new Error('Failed to record refund')
    }
  }
  return res.json()
}

export async function createBookingPaymentLink(
  bookingId: number,
  amount: number,
  paymentProvider?: 'paymongo' | 'xendit',
): Promise<BookingPaymentLinkRecord> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${bookingId}/payment-links/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount: amount.toFixed(2),
        ...(paymentProvider ? { payment_provider: paymentProvider } : {}),
      }),
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
  const body = await readJsonResponse<PublicPaymentLinkRecord | Record<string, unknown>>(
    res,
    'Payment link not found',
  )
  if (!res.ok) {
    throw new Error(extractError(body) || 'Payment link not found')
  }
  return body as PublicPaymentLinkRecord
}

export type PublicPaymentLinkConfirmResult = {
  confirmed: boolean
  pending: boolean
  already_recorded: boolean
  payment_link: PublicPaymentLinkRecord
}

export async function confirmPublicPaymentLink(
  token: string,
): Promise<PublicPaymentLinkConfirmResult> {
  const res = await fetch(
    buildApiUrl(`/public/payment-links/${token}/confirm/?status=success`),
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
    },
  )
  const body = await readJsonResponse<PublicPaymentLinkConfirmResult | Record<string, unknown>>(
    res,
    'Could not confirm payment',
  )
  if (!res.ok) {
    throw new Error(extractError(body) || 'Could not confirm payment')
  }
  return body as PublicPaymentLinkConfirmResult
}
