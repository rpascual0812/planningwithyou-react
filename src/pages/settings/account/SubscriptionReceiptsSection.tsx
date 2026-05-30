import { useCallback, useEffect, useState } from 'react'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import { fetchCurrentAccount } from '../../../services/accounts'
import {
  downloadSubscriptionReceipt,
  fetchSubscriptionReceipts,
  type SubscriptionReceiptRecord,
} from '../../../services/subscriptions'
import {
  formatCurrency,
  localeFromIso2,
  type CurrencyFormatOptions,
} from '../../../utils/currency'

function formatReceiptDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const SubscriptionReceiptsSection = () => {
  const { canRead: accountRead } = useFeatureAccess('account_settings')
  const [receipts, setReceipts] = useState<SubscriptionReceiptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [currencyFormat, setCurrencyFormat] = useState<CurrencyFormatOptions>({
    currencyCode: 'PHP',
    locale: 'en-PH',
  })

  const loadReceipts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [account, rows] = await Promise.all([
        fetchCurrentAccount(),
        fetchSubscriptionReceipts(),
      ])
      setCurrencyFormat({
        currencyCode: account.country_currency_code || 'PHP',
        locale: localeFromIso2(account.country_iso2_code),
      })
      setReceipts(rows)
    } catch (e) {
      setReceipts([])
      setError(e instanceof Error ? e.message : 'Failed to load receipts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!accountRead) {
      setLoading(false)
      return
    }
    void loadReceipts()
  }, [accountRead, loadReceipts])

  const handleDownload = async (receipt: SubscriptionReceiptRecord) => {
    setDownloadingId(receipt.id)
    setError(null)
    try {
      await downloadSubscriptionReceipt(receipt.id)
    } catch (e) {
      if (receipt.receipt_url) {
        window.open(receipt.receipt_url, '_blank', 'noopener,noreferrer')
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
    return <p className="text-muted small mb-0">Loading receipts…</p>
  }

  return (
    <div className="sub-receipts">
      <p className="sub-receipts-intro text-muted small">
        PDF receipts for subscription payments (initial and recurring). A copy is
        also sent to your account contact email when PayMongo confirms payment.
      </p>

      {error && (
        <p className="sub-pay-error" role="alert">
          {error}
        </p>
      )}

      {receipts.length === 0 ? (
        <p className="text-muted small mb-0">No subscription receipts yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle sub-receipts-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Plan</th>
                <th>Paid</th>
                <th>Amount</th>
                <th className="text-end">Download</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td>
                    <span className="fw-semibold">{receipt.receipt_number}</span>
                    <br />
                    <span className="text-muted small">
                      {formatReceiptDate(receipt.paid_at)}
                    </span>
                  </td>
                  <td>{receipt.plan_name}</td>
                  <td className="text-muted small">
                    {receipt.period_start}
                    {receipt.period_end ? ` – ${receipt.period_end}` : ''}
                  </td>
                  <td>
                    {formatCurrency(Number(receipt.amount), currencyFormat)}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={downloadingId === receipt.id}
                      onClick={() => void handleDownload(receipt)}
                    >
                      {downloadingId === receipt.id ? 'Downloading…' : 'PDF'}
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
