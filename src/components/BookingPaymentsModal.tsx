import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelBookingPaymentLink,
  createBookingPaymentLink,
  fetchBookingPaymentLinks,
  type BookingPaymentLinkRecord,
  type BookingPaymentSummary,
} from '../services/bookingPaymentLinks'
import { formatCurrency } from '../utils/currency'
import type { CurrencyFormatOptions } from '../utils/currency'
import { showErrorToast, showSuccessToast } from '../utils/toast'

type Props = {
  bookingId: number
  bookingTotal: number
  requiredDownpayment: number
  contactEmail: string
  currencyOptions: CurrencyFormatOptions
  onClose: () => void
  onSendToCustomer: (link: BookingPaymentLinkRecord) => void
}

function paymentLinkOpenUrl(link: BookingPaymentLinkRecord): string {
  return (link.public_url || link.checkout_url || '').trim()
}

function formatPaymentLinkDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function parseSummaryAmount(value: string | number | undefined): number {
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

function defaultChargeInput(
  summary: BookingPaymentSummary | null,
  requiredDownpayment: number,
): string {
  if (!summary) return ''
  const remaining = parseSummaryAmount(summary.remaining_amount)
  if (remaining <= 0) return '0'
  if (summary.has_paid_payment) {
    return remaining.toFixed(2)
  }
  const down = parseSummaryAmount(summary.required_downpayment_amount)
  const use = down > 0 ? down : requiredDownpayment
  return Math.min(use > 0 ? use : remaining, remaining).toFixed(2)
}

export default function BookingPaymentsModal({
  bookingId,
  bookingTotal,
  requiredDownpayment,
  contactEmail,
  currencyOptions,
  onClose,
  onSendToCustomer,
}: Props) {
  const [links, setLinks] = useState<BookingPaymentLinkRecord[]>([])
  const [summary, setSummary] = useState<BookingPaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [chargeInput, setChargeInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBookingPaymentLinks(bookingId)
      setLinks(data.links)
      setSummary(data.summary)
      setChargeInput(defaultChargeInput(data.summary, requiredDownpayment))
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to load payment links')
    } finally {
      setLoading(false)
    }
  }, [bookingId, requiredDownpayment])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const summaryDisplay = useMemo(() => {
    const total = summary
      ? parseSummaryAmount(summary.total_amount)
      : bookingTotal
    const down = summary
      ? parseSummaryAmount(summary.required_downpayment_amount)
      : requiredDownpayment
    const paid = summary ? parseSummaryAmount(summary.paid_amount) : 0
    const remaining = summary
      ? parseSummaryAmount(summary.remaining_amount)
      : Math.max(0, total - paid)
    return { total, down, paid, remaining }
  }, [summary, bookingTotal, requiredDownpayment])

  const handleCreate = async () => {
    const remaining = summaryDisplay.remaining
    if (remaining <= 0) {
      showErrorToast('This booking is already fully paid.')
      return
    }
    const amount = Number.parseFloat(chargeInput.trim())
    if (Number.isNaN(amount) || amount <= 0) {
      showErrorToast('Enter a valid payment amount greater than zero.')
      return
    }
    if (amount > remaining + 0.0001) {
      showErrorToast(
        `Amount cannot exceed the remaining balance (${formatCurrency(remaining, currencyOptions)}).`,
      )
      return
    }
    setCreating(true)
    try {
      const link = await createBookingPaymentLink(bookingId, amount)
      const refreshed = await fetchBookingPaymentLinks(bookingId)
      setLinks(refreshed.links)
      setSummary(refreshed.summary)
      setChargeInput(defaultChargeInput(refreshed.summary, requiredDownpayment))
      showSuccessToast('Payment link created.')
      onSendToCustomer(link)
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to create payment link')
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = async (link: BookingPaymentLinkRecord) => {
    if (link.status === 'paid') return
    setCancellingId(link.id)
    try {
      await cancelBookingPaymentLink(bookingId, link.id)
      const refreshed = await fetchBookingPaymentLinks(bookingId)
      setLinks(refreshed.links)
      setSummary(refreshed.summary)
      setChargeInput(defaultChargeInput(refreshed.summary, requiredDownpayment))
      showSuccessToast('Payment link cancelled.')
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to cancel payment link')
    } finally {
      setCancellingId(null)
    }
  }

  const formatAmount = (link: BookingPaymentLinkRecord) =>
    formatCurrency(Number(link.charge_amount), {
      ...currencyOptions,
      currencyCode: link.currency || currencyOptions.currencyCode,
    })

  const chargeLabel = summary?.has_paid_payment
    ? 'Amount to collect (remaining balance)'
    : 'Amount to collect (downpayment)'

  return (
    <>
      <div
        className="booking-payments-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="booking-payments-modal modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookingPaymentsTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="bookingPaymentsTitle" className="modal-title fs-5 mb-0">
                Payments
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <div className="booking-payments-charge-panel mb-3">
                <h6 className="booking-payments-charge-panel__title mb-2">
                  Payment summary
                </h6>
                <dl className="booking-payments-summary-dl mb-3">
                  <div className="booking-payments-summary-dl__row">
                    <dt>Total amount</dt>
                    <dd>{formatCurrency(summaryDisplay.total, currencyOptions)}</dd>
                  </div>
                  <div className="booking-payments-summary-dl__row">
                    <dt>Downpayment</dt>
                    <dd>{formatCurrency(summaryDisplay.down, currencyOptions)}</dd>
                  </div>
                  {summaryDisplay.paid > 0 && (
                    <div className="booking-payments-summary-dl__row">
                      <dt>Paid</dt>
                      <dd>{formatCurrency(summaryDisplay.paid, currencyOptions)}</dd>
                    </div>
                  )}
                  <div className="booking-payments-summary-dl__row booking-payments-summary-dl__row--emphasis">
                    <dt>Remaining</dt>
                    <dd>{formatCurrency(summaryDisplay.remaining, currencyOptions)}</dd>
                  </div>
                </dl>
                <label
                  className="form-label"
                  htmlFor="booking-payment-charge-amount"
                >
                  {chargeLabel}
                </label>
                <div className="d-flex flex-wrap gap-2 align-items-stretch">
                  <input
                    id="booking-payment-charge-amount"
                    type="number"
                    className="form-control booking-payments-charge-input"
                    min={0}
                    step="0.01"
                    max={summaryDisplay.remaining}
                    value={chargeInput}
                    disabled={summaryDisplay.remaining <= 0 || loading}
                    onChange={(e) => setChargeInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      creating ||
                      loading ||
                      summaryDisplay.remaining <= 0
                    }
                    onClick={() => void handleCreate()}
                  >
                    {creating ? (
                      <span
                        className="spinner-border spinner-border-sm"
                        role="status"
                        aria-hidden
                      />
                    ) : (
                      <>
                        <i className="bi bi-link-45deg me-1" aria-hidden />
                        Generate payment link
                      </>
                    )}
                  </button>
                </div>
                <p className="text-muted small mb-0 mt-2">
                  Customer pays via PayMongo (all methods). Amount is grossed up for
                  processing and a 1% platform fee.
                </p>
              </div>

              <div className="booking-payments-table-card">
                <div className="booking-payments-table-scroll">
                  {loading && links.length === 0 ? (
                    <div className="booking-payments-table-empty-wrap">
                      <span className="booking-payments-table-empty">Loading…</span>
                    </div>
                  ) : (
                    <table className="booking-payments-table">
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Id</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th className="booking-payments-th-actions">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {links.map((link) => {
                          const canAct = link.status === 'pending'
                          const openUrl = paymentLinkOpenUrl(link)
                          const email = contactEmail.trim() || '—'
                          return (
                            <tr key={link.id} className="booking-payments-table-row">
                              <td className="booking-payments-table-email">
                                {email}
                              </td>
                              <td className="booking-payments-table-id">
                                {canAct ? (
                                  <a
                                    href={link.public_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="booking-payments-table-id-link"
                                  >
                                    #{link.id}
                                  </a>
                                ) : (
                                  `#${link.id}`
                                )}
                              </td>
                              <td className="booking-payments-table-amount">
                                {formatAmount(link)}
                              </td>
                              <td className="booking-payments-table-date">
                                {formatPaymentLinkDate(link.created_at)}
                              </td>
                              <td>
                                <div className="booking-payments-actions">
                                  <button
                                    type="button"
                                    className="booking-payments-action-btn booking-payments-action-btn--open"
                                    title="Open payment link"
                                    disabled={!openUrl}
                                    onClick={() =>
                                      window.open(openUrl, '_blank', 'noopener,noreferrer')
                                    }
                                  >
                                    <i className="bi bi-box-arrow-up-right" aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    className="booking-payments-action-btn booking-payments-action-btn--delete"
                                    title="Cancel link"
                                    disabled={!canAct || cancellingId === link.id}
                                    onClick={() => void handleCancel(link)}
                                  >
                                    {cancellingId === link.id ? (
                                      <span
                                        className="spinner-border spinner-border-sm"
                                        role="status"
                                        aria-hidden
                                      />
                                    ) : (
                                      <i className="bi bi-trash3" aria-hidden />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    className="booking-payments-action-btn booking-payments-action-btn--edit"
                                    title="Resend link to customer"
                                    disabled={!canAct}
                                    onClick={() => onSendToCustomer(link)}
                                  >
                                    <i className="bi bi-envelope" aria-hidden />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {links.length === 0 && !loading && (
                          <tr>
                            <td colSpan={5} className="booking-payments-table-empty">
                              No payment links yet. Generate one to get started.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
