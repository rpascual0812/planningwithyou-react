import { useCallback, useEffect, useState } from 'react'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import { formatAppDate } from '../../../lib/formatDateTime'
import { fetchCurrentAccount } from '../../../services/accounts'
import {
  downloadSubscriptionPaymentReceipt,
  fetchSubscriptionPayments,
  type SubscriptionPaymentRecord,
} from '../../../services/subscriptions'
import {
  formatCurrency,
  localeFromIso2,
  type CurrencyFormatOptions,
} from '../../../utils/currency'

function formatPaidAt(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatPeriod(start: string, end: string | null): string {
  const startLabel = formatAppDate(start)
  if (!end) return `${startLabel} – ongoing`
  return `${startLabel} – ${formatAppDate(end)}`
}

const SubscriptionReceiptsSection = () => {
  const { canRead: accountRead } = useFeatureAccess('account_settings')
  const [payments, setPayments] = useState<SubscriptionPaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [currencyFormat, setCurrencyFormat] = useState<CurrencyFormatOptions>({
    currencyCode: 'PHP',
    locale: 'en-PH',
  })

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [account, rows] = await Promise.all([
        fetchCurrentAccount(),
        fetchSubscriptionPayments(),
      ])
      setCurrencyFormat({
        currencyCode: account.country_currency_code || 'PHP',
        locale: localeFromIso2(account.country_iso2_code),
      })
      setPayments(rows)
    } catch (e) {
      setPayments([])
      setError(e instanceof Error ? e.message : 'Failed to load subscription payments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!accountRead) {
      setLoading(false)
      return
    }
    void loadPayments()
  }, [accountRead, loadPayments])

  const handleDownload = async (payment: SubscriptionPaymentRecord) => {
    setDownloadingId(payment.id)
    setError(null)
    try {
      await downloadSubscriptionPaymentReceipt(payment.id)
    } catch (e) {
      const receiptUrl = payment.receipt?.receipt_url
      if (receiptUrl) {
        window.open(receiptUrl, '_blank', 'noopener,noreferrer')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to download receipt')
      }
    } finally {
      setDownloadingId(null)
    }
  }

  if (!accountRead) {
    return (
      <p className="text-muted small mb-0">
        You do not have permission to view receipts.
      </p>
    )
  }

  if (loading) {
    return <p className="text-muted small mb-0">Loading subscription payments…</p>
  }

  return (
    <div className="sub-receipts">
      <p className="sub-receipts-intro text-muted small">
        Successful subscription charges recorded from PayMongo. Download a PDF receipt
        for any payment below; a copy is also emailed to your account contact address
        when available.
      </p>

      {error && (
        <p className="sub-pay-error" role="alert">
          {error}
        </p>
      )}

      {payments.length === 0 ? (
        <p className="text-muted small mb-0">No subscription payments yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle sub-receipts-table">
            <thead>
              <tr>
                <th>Paid</th>
                <th>Plan</th>
                <th>Billing period</th>
                <th>Amount</th>
                <th>Receipt</th>
                <th className="text-end">Download</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <span className="fw-semibold">{formatPaidAt(payment.paid_at)}</span>
                    {payment.description ? (
                      <>
                        <br />
                        <span className="text-muted small">{payment.description}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{payment.plan_name || '—'}</td>
                  <td className="text-muted small">
                    {formatPeriod(payment.period_start, payment.period_end)}
                  </td>
                  <td>
                    {formatCurrency(Number(payment.amount), currencyFormat)}
                  </td>
                  <td className="text-muted small">
                    {payment.receipt?.receipt_number ?? '—'}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={downloadingId === payment.id}
                      onClick={() => void handleDownload(payment)}
                    >
                      {downloadingId === payment.id ? 'Downloading…' : 'PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default SubscriptionReceiptsSection
