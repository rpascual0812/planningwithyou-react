import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  confirmPublicPaymentLink,
  fetchPublicPaymentLink,
  hasPaySuccessSession,
  markPaySuccessSession,
  type PublicPaymentLinkRecord,
} from '../services/bookingPaymentLinks'
import { formatCurrency, type CurrencyFormatOptions } from '../utils/currency'

export default function PublicPayPage() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const [data, setData] = useState<PublicPaymentLinkRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [alreadyRecorded, setAlreadyRecorded] = useState(false)
  const [confirmPending, setConfirmPending] = useState(false)
  const confirmAttempted = useRef(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid payment link.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchPublicPaymentLink(token)
      .then((record) => {
        if (!cancelled) {
          setData(record)
          setError(null)
          if (
            statusParam === 'success' &&
            (record.status === 'paid' || hasPaySuccessSession(token))
          ) {
            setAlreadyRecorded(true)
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Payment link not found')
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, statusParam])

  useEffect(() => {
    if (!token || statusParam !== 'success' || confirmAttempted.current) {
      return
    }
    if (loading || error || !data) {
      return
    }

    if (data.status === 'paid' || hasPaySuccessSession(token)) {
      confirmAttempted.current = true
      setAlreadyRecorded(true)
      return
    }

    if (data.status !== 'pending') {
      return
    }

    confirmAttempted.current = true
    let cancelled = false
    setConfirming(true)
    setConfirmPending(false)

    confirmPublicPaymentLink(token)
      .then((result) => {
        if (cancelled) return
        setData(result.payment_link)
        if (result.already_recorded) {
          setAlreadyRecorded(true)
          return
        }
        if (result.confirmed) {
          markPaySuccessSession(token)
          setAlreadyRecorded(false)
          return
        }
        setConfirmPending(true)
      })
      .catch(() => {
        if (cancelled) return
        setConfirmPending(true)
      })
      .finally(() => {
        if (!cancelled) setConfirming(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, statusParam, loading, error, data])

  const currencyOptions: CurrencyFormatOptions = useMemo(
    () => ({
      currencyCode: data?.currency || 'PHP',
      currencySymbol: data?.currency_symbol || '₱',
      locale: 'en-PH',
    }),
    [data?.currency, data?.currency_symbol],
  )

  const fmt = (amount: string) => formatCurrency(Number(amount), currencyOptions)

  if (loading) {
    return (
      <div className="public-pay-page">
        <div className="public-pay-card">
          <p className="mb-0 text-muted">Loading payment…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="public-pay-page">
        <div className="public-pay-card">
          <h1 className="h4 mb-2">Payment unavailable</h1>
          <p className="text-muted mb-0">{error ?? 'This link is not valid.'}</p>
        </div>
      </div>
    )
  }

  const isPaid = data.status === 'paid'
  const isExpired = data.status === 'expired'
  const canPay = data.status === 'pending' && Boolean(data.checkout_url)
  const isSuccessReturn = statusParam === 'success'

  return (
    <div className="public-pay-page">
      <div className="public-pay-card">
        <p className="public-pay-card__eyebrow mb-1">{data.company_name}</p>
        <h1 className="h4 mb-1">{data.quotation_title}</h1>
        {data.quotation_unique_id && (
          <p className="text-muted small mb-3">Quotation ID: {data.quotation_unique_id}</p>
        )}

        {isSuccessReturn && confirming && !isPaid && (
          <div className="alert alert-info py-2 small" role="status">
            Confirming your payment…
          </div>
        )}
        {isSuccessReturn && confirmPending && !isPaid && !confirming && (
          <div className="alert alert-info py-2 small" role="status">
            Payment submitted. We could not confirm it yet — refresh in a moment or contact
            the business if this persists.
          </div>
        )}
        {statusParam === 'cancelled' && (
          <div className="alert alert-warning py-2 small" role="status">
            Payment was cancelled. You can try again below.
          </div>
        )}

        {isPaid || (isSuccessReturn && alreadyRecorded) ? (
          <div className="alert alert-success" role="status">
            {isSuccessReturn && alreadyRecorded ? (
              <>
                <strong>Payment already recorded.</strong> This payment was confirmed on a
                previous visit. No further action is needed.
              </>
            ) : (
              <>
                <strong>Thank you.</strong>{' '}
                {isSuccessReturn
                  ? 'Your payment has been recorded.'
                  : 'This quotation has been paid.'}
              </>
            )}
          </div>
        ) : isExpired ? (
          <div className="alert alert-secondary" role="status">
            This payment link has expired. Contact the business for a new link.
          </div>
        ) : (
          <>
            <table className="table table-sm public-pay-breakdown mb-3">
              <tbody>
                <tr>
                  <td>Quotation total</td>
                  <td className="text-end">{fmt(data.base_amount)}</td>
                </tr>
                <tr>
                  <td>Processing fee (est.)</td>
                  <td className="text-end">{fmt(data.processing_fee_estimate)}</td>
                </tr>
                <tr>
                  <td>Platform fee (1%)</td>
                  <td className="text-end">{fmt(data.platform_fee)}</td>
                </tr>
                <tr className="fw-semibold">
                  <td>Total due</td>
                  <td className="text-end">{fmt(data.charge_amount)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-muted small">
              Pay with card, e-wallet, QR Ph, or other methods offered at checkout.
              Fees are estimated using worst-case card rates so your quote amount is
              protected.
            </p>
            {canPay ? (
              <a
                href={data.checkout_url}
                className="btn btn-primary btn-lg w-100"
              >
                Pay now
              </a>
            ) : (
              <p className="text-muted mb-0">Checkout is not available for this link.</p>
            )}
            <p className="text-muted small mt-3 mb-0">
              Link expires {new Date(data.expires_at).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
