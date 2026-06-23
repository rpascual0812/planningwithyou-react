import { useEffect, useMemo, useState } from 'react'
import type { CurrencyFormatOptions } from '../utils/currency'
import { formatCurrency } from '../utils/currency'
import {
  applyQuotationDiscount,
  EMPTY_QUOTATION_PRICING_ADJUSTMENT,
  type QuotationPricingAdjustment,
  validateQuotationDiscount,
  validateQuotationOverrideTotal,
} from '../lib/quotationPricingAdjustments'

export type QuotationPricingPanel = 'discount' | 'override'

type Props = {
  open: boolean
  lineSubtotal: number
  currencyOptions: CurrencyFormatOptions
  value: QuotationPricingAdjustment
  onClose: () => void
  onApply: (next: QuotationPricingAdjustment) => void
}

const QuotationPricingModal = ({
  open,
  lineSubtotal,
  currencyOptions,
  value,
  onClose,
  onApply,
}: Props) => {
  const [panel, setPanel] = useState<QuotationPricingPanel>('discount')
  const [draft, setDraft] = useState<QuotationPricingAdjustment>(value)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(value)
    setPanel(value.overrideTotalAmount.trim() ? 'override' : 'discount')
    setError(null)
  }, [open, value])

  const previewTotal = useMemo(() => {
    if (panel === 'override') {
      const raw = draft.overrideTotalAmount.trim()
      if (!raw) return lineSubtotal
      const n = Number(raw)
      return Number.isNaN(n) || n < 0 ? lineSubtotal : n
    }
    if (!draft.discountAmount.trim()) return lineSubtotal
    return applyQuotationDiscount(
      lineSubtotal,
      draft.discountAmount,
      draft.discountType,
    )
  }, [draft, lineSubtotal, panel])

  const handleApply = () => {
    if (panel === 'override') {
      const validation = validateQuotationOverrideTotal(draft.overrideTotalAmount)
      if (validation) {
        setError(validation)
        return
      }
      onApply({
        ...EMPTY_QUOTATION_PRICING_ADJUSTMENT,
        overrideTotalAmount: draft.overrideTotalAmount.trim(),
      })
      onClose()
      return
    }

    if (!draft.discountAmount.trim()) {
      onApply({ ...EMPTY_QUOTATION_PRICING_ADJUSTMENT })
      onClose()
      return
    }

    const validation = validateQuotationDiscount(
      lineSubtotal,
      draft.discountAmount,
      draft.discountType,
    )
    if (validation) {
      setError(validation)
      return
    }

    onApply({
      discountAmount: draft.discountAmount.trim(),
      discountType: draft.discountType,
      overrideTotalAmount: '',
    })
    onClose()
  }

  const handleClear = () => {
    onApply({ ...EMPTY_QUOTATION_PRICING_ADJUSTMENT })
    onClose()
  }

  if (!open) return null

  return (
    <>
      <div
        className="modal-backdrop fade show quotation-pricing-modal-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="modal fade show d-block quotation-pricing-modal"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quotationPricingModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="quotationPricingModalTitle" className="modal-title fs-5 mb-0">
                Quotation pricing
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body p-0">
              <div className="quotation-pricing-modal__layout">
                <nav
                  className="quotation-pricing-modal__nav"
                  aria-label="Pricing options"
                >
                  <button
                    type="button"
                    className={`quotation-pricing-modal__nav-link${
                      panel === 'discount' ? ' is-active' : ''
                    }`}
                    onClick={() => {
                      setPanel('discount')
                      setError(null)
                    }}
                  >
                    Apply Discount
                  </button>
                  <button
                    type="button"
                    className={`quotation-pricing-modal__nav-link${
                      panel === 'override' ? ' is-active' : ''
                    }`}
                    onClick={() => {
                      setPanel('override')
                      setError(null)
                    }}
                  >
                    Override Total
                  </button>
                </nav>
                <div className="quotation-pricing-modal__panel">
                  <p className="text-muted small mb-3">
                    Line-item subtotal:{' '}
                    <span className="fw-semibold text-body">
                      {formatCurrency(lineSubtotal, currencyOptions)}
                    </span>
                  </p>

                  {panel === 'discount' ? (
                    <>
                      <p className="small mb-3">
                        Reduce the quotation total by a percentage or fixed amount.
                      </p>
                      <div className="row g-2 align-items-end">
                        <div className="col-sm-5">
                          <label
                            htmlFor="quotation-discount-amount"
                            className="form-label"
                          >
                            Discount
                          </label>
                          <input
                            id="quotation-discount-amount"
                            type="number"
                            className="form-control"
                            min="0"
                            step="0.01"
                            value={draft.discountAmount}
                            onChange={(e) => {
                              setDraft((prev) => ({
                                ...prev,
                                discountAmount: e.target.value,
                              }))
                              setError(null)
                            }}
                            placeholder={
                              draft.discountType === 'percent' ? 'e.g. 10' : '0.00'
                            }
                          />
                        </div>
                        <div className="col-sm-4">
                          <label
                            htmlFor="quotation-discount-type"
                            className="form-label"
                          >
                            Type
                          </label>
                          <select
                            id="quotation-discount-type"
                            className="form-select"
                            value={draft.discountType}
                            onChange={(e) => {
                              setDraft((prev) => ({
                                ...prev,
                                discountType:
                                  e.target.value === 'fixed' ? 'fixed' : 'percent',
                              }))
                              setError(null)
                            }}
                          >
                            <option value="percent">Percent (%)</option>
                            <option value="fixed">Fixed amount</option>
                          </select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="small mb-3">
                        Set an exact quotation total instead of using the line-item
                        subtotal.
                      </p>
                      <div className="col-sm-6 px-0">
                        <label
                          htmlFor="quotation-override-total"
                          className="form-label"
                        >
                          Override total
                        </label>
                        <input
                          id="quotation-override-total"
                          type="number"
                          className="form-control"
                          min="0"
                          step="0.01"
                          value={draft.overrideTotalAmount}
                          onChange={(e) => {
                            setDraft((prev) => ({
                              ...prev,
                              overrideTotalAmount: e.target.value,
                            }))
                            setError(null)
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </>
                  )}

                  <div className="quotation-pricing-modal__preview mt-4">
                    <span className="text-muted small">New total</span>
                    <div className="fs-5 fw-semibold">
                      {formatCurrency(previewTotal, currencyOptions)}
                    </div>
                  </div>

                  {error && (
                    <div className="alert alert-danger py-2 small mt-3 mb-0">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-link text-danger me-auto"
                onClick={handleClear}
              >
                Clear adjustment
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleApply}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default QuotationPricingModal
