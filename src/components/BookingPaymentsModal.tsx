import { useCallback, useEffect, useState } from 'react'
import {
  cancelBookingPaymentLink,
  createBookingPaymentLink,
  fetchBookingPaymentLinks,
  type BookingPaymentLinkRecord,
} from '../services/bookingPaymentLinks'
import { formatCurrency } from '../utils/currency'
import type { CurrencyFormatOptions } from '../utils/currency'
import { showErrorToast, showSuccessToast } from '../utils/toast'

type Props = {
  bookingId: number
  bookingTotal: number
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

export default function BookingPaymentsModal({
  bookingId,
  bookingTotal,
  contactEmail,
  currencyOptions,
  onClose,
  onSendToCustomer,
}: Props) {
  const [links, setLinks] = useState<BookingPaymentLinkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBookingPaymentLinks(bookingId)
      setLinks(data)
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to load payment links')
    } finally {
      setLoading(false)
    }
  }, [bookingId])

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

  const handleCreate = async () => {
    if (bookingTotal <= 0) {
      showErrorToast('Save the booking with a quote total before creating a payment link.')
      return
    }
    setCreating(true)
    try {
      const link = await createBookingPaymentLink(bookingId)
      setLinks((prev) => [link, ...prev])
      await navigator.clipboard.writeText(link.public_url)
      showSuccessToast('Payment link created and copied to clipboard.')
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
      setLinks((prev) =>
        prev.map((row) =>
          row.id === link.id ? { ...row, status: 'cancelled' } : row,
        ),
      )
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
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <p className="text-muted small mb-0">
                  Customer pays via PayMongo (all methods). Amount is grossed up for
                  processing and a 1% platform fee.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={creating || loading}
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
                          const email =
                            contactEmail.trim() || '—'
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
                                    disabled={
                                      !canAct || cancellingId === link.id
                                    }
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
                                    title="Send link to customer"
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
