import { useState, type FormEvent } from 'react'
import {
  createManualBookingRefund,
  type ManualBookingPaymentPayload,
} from '../services/bookingPaymentLinks'
import { showErrorToast, showSuccessToast } from '../utils/toast'

const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer'] as const

type Props = {
  bookingId: number
  maxRefundAmount: number
  defaultAmount?: string
  onClose: () => void
  onSaved: () => void
}

export default function RefundModal({
  bookingId,
  maxRefundAmount,
  defaultAmount = '',
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState(defaultAmount)
  const [paymentMethod, setPaymentMethod] =
    useState<ManualBookingPaymentPayload['payment_method']>('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showErrorToast('Enter a valid refund amount greater than zero.')
      return
    }
    if (parsed > maxRefundAmount) {
      showErrorToast('Refund amount cannot exceed the amount already paid.')
      return
    }
    setSaving(true)
    try {
      await createManualBookingRefund(bookingId, {
        amount: parsed.toFixed(2),
        payment_method: paymentMethod,
        notes: notes.trim(),
      })
      showSuccessToast('Refund recorded.')
      onSaved()
      onClose()
    } catch (err) {
      showErrorToast(
        err instanceof Error ? err.message : 'Failed to record refund',
      )
    } finally {
      setSaving(false)
    }
  }

  const canRefund = maxRefundAmount > 0

  return (
    <>
      <div
        className="booking-payments-modal-backdrop modal-backdrop fade show booking-payments-modal--stacked"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="booking-payments-modal modal fade show d-block booking-payments-modal--stacked"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refundPaymentTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className="modal-header">
                <h1 id="refundPaymentTitle" className="modal-title fs-5 mb-0">
                  Record refund
                </h1>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                  disabled={saving}
                />
              </div>
              <div className="modal-body">
                {!canRefund ? (
                  <p className="text-muted small mb-0">
                    There is no paid balance to refund on this quotation.
                  </p>
                ) : (
                  <>
                    <p className="text-muted small">
                      Refunds are saved with status{' '}
                      <strong>refunded</strong> and reduce the paid balance on
                      this quotation. No receipt email is sent.
                    </p>
                    <div className="mb-3">
                      <label htmlFor="refund-amount" className="form-label">
                        Amount
                      </label>
                      <input
                        id="refund-amount"
                        type="number"
                        className="form-control"
                        min="0.01"
                        max={maxRefundAmount}
                        step="0.01"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={saving}
                      />
                      <div className="form-text">
                        Maximum refundable: {maxRefundAmount.toFixed(2)}
                      </div>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="refund-method" className="form-label">
                        Payment method
                      </label>
                      <select
                        id="refund-method"
                        className="form-select"
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(
                            e.target.value as ManualBookingPaymentPayload['payment_method'],
                          )
                        }
                        disabled={saving}
                      >
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-0">
                      <label htmlFor="refund-notes" className="form-label">
                        Notes
                      </label>
                      <textarea
                        id="refund-notes"
                        className="form-control"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-outline-danger"
                  disabled={saving || !canRefund}
                >
                  {saving ? 'Saving…' : 'Save refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
