export type BookingPaymentStatusKind = 'unpaid' | 'partial' | 'paid'

export type BookingPaymentStatusInput = {
  total_amount?: string | null
  paid_amount?: string | null
  remaining_amount?: string | null
}

function parseAmount(raw: string | null | undefined): number {
  const n = Number((raw ?? '').trim())
  return Number.isNaN(n) ? 0 : n
}

/** Returns null when the booking has no priced total (no payment tracking). */
export function bookingPaymentStatus(
  item: BookingPaymentStatusInput,
): BookingPaymentStatusKind | null {
  const total = parseAmount(item.total_amount)
  if (total <= 0) return null

  const paid = parseAmount(item.paid_amount)
  const remaining =
    item.remaining_amount != null && String(item.remaining_amount).trim() !== ''
      ? parseAmount(item.remaining_amount)
      : Math.max(0, total - paid)

  if (paid <= 0) return 'unpaid'
  if (remaining <= 0.0001) return 'paid'
  return 'partial'
}

export const BOOKING_PAYMENT_STATUS_LABELS: Record<
  BookingPaymentStatusKind,
  string
> = {
  unpaid: 'No payment',
  partial: 'Partially paid',
  paid: 'Paid',
}
