import { useState, type FormEvent } from 'react'
import {
  createManualBookingPayment,
  type ManualBookingPaymentPayload,
} from '../services/bookingPaymentLinks'
import { showErrorToast, showSuccessToast } from '../utils/toast'

const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer'] as const

type Props = {
  bookingId: number
  contactEmail: string
  defaultAmount?: string
  onClose: () => void
  onSaved: () => void
}

export default function ManualPaymentModal({
  bookingId,
  contactEmail,
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
      showErrorToast('Enter a valid payment amount greater than zero.')
      return
    }
    setSaving(true)
    try {
      await createManualBookingPayment(bookingId, {
        amount: parsed.toFixed(2),
        payment_method: paymentMethod,
        notes: notes.trim(),
      })
      showSuccessToast(
        contactEmail.trim()
          ? `Manual payment recorded. Receipt email queued for ${contactEmail.trim()}.`
          : 'Manual payment recorded.',
      )
      onSaved()
      onClose()
    } catch (err) {
      showErrorToast(
        err instanceof Error ? err.message : 'Failed to record manual payment',
      )
    } finally {
      setSaving(false)
    }
  }

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
        aria-labelledby="manualPaymentTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={(e) => void handleSubmit(e)}>
              <div className="modal-header">
                <h1 id="manualPaymentTitle" className="modal-title fs-5 mb-0">
                  Add manual payment
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
                <p className="text-muted small">
                  Platform and processing fees are recorded as zero. Transaction
                  ID, status, and payout date are set automatically.
                </p>
                {!contactEmail.trim() && (
                  <p className="alert alert-warning py-2 small mb-3" role="status">
                    No contact email on this quotation — payment will be saved
                    but no receipt email will be sent.
                  </p>
                )}
                <div className="mb-3">
                  <label htmlFor="manual-payment-amount" className="form-label">
                    Amount
                  </label>
                  <input
                    id="manual-payment-amount"
                    type="number"
                    className="form-control"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={saving}
                  />
                  <div className="form-text">
                    Applied to amount, charge amount, base amount, and net
                    amount.
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="manual-payment-method" className="form-label">
                    Payment method
                  </label>
                  <select
                    id="manual-payment-method"
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
                  <label htmlFor="manual-payment-notes" className="form-label">
                    Notes
                  </label>
                  <textarea
                    id="manual-payment-notes"
                    className="form-control"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={saving}
                  />
                </div>
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
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
