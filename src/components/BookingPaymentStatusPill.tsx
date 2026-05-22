import {
  BOOKING_PAYMENT_STATUS_LABELS,
  bookingPaymentStatus,
  type BookingPaymentStatusInput,
} from '../lib/bookingPaymentStatus'

type Props = {
  item: BookingPaymentStatusInput
  className?: string
}

export default function BookingPaymentStatusPill({ item, className }: Props) {
  const status = bookingPaymentStatus(item)
  if (!status) return null

  const extra = className?.trim() ? ` ${className.trim()}` : ''

  return (
    <span
      className={`booking-payment-status booking-payment-status--${status}${extra}`}
    >
      {BOOKING_PAYMENT_STATUS_LABELS[status]}
    </span>
  )
}
