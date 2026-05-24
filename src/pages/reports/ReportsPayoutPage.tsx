import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchBookingPayouts,
  type BookingPayoutRecord,
} from '../../services/bookingPayouts'

const PAYOUT_FILTER_OPTIONS = [
  { value: '', label: 'All payouts' },
  { value: 'pending', label: 'Pending payout' },
  { value: 'sent', label: 'Payout sent' },
] as const

type PayoutFilter = (typeof PAYOUT_FILTER_OPTIONS)[number]['value']

function formatMoney(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildPayoutsCsv(rows: BookingPayoutRecord[]): string {
  const headers = [
    'Booking ID',
    'Booking title',
    'Amount',
    'Transaction ID',
    'Transaction status',
    'Paid',
    'Payout status',
    'Payout sent at',
  ]
  const lines = rows.map((row) => [
    row.booking_unique_id || '',
    row.booking_title || '',
    formatMoney(row.booking_credit),
    row.transaction_id || '',
    row.transaction_status || '',
    formatDateTime(row.transaction_date),
    row.payout_sent ? 'Sent' : 'Pending',
    formatDateTime(row.payout_sent_at),
  ])
  return [
    headers.map(csvEscape).join(','),
    ...lines.map((line) => line.map(csvEscape).join(',')),
  ].join('\n')
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const ReportsPayoutPage = () => {
  const [rows, setRows] = useState<BookingPayoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBookingPayouts({
        payout: payoutFilter || undefined,
        search: debouncedSearch,
      })
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payouts')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [payoutFilter, debouncedSearch])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const handleExportCsv = () => {
    if (rows.length === 0) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`payouts-${stamp}.csv`, buildPayoutsCsv(rows))
  }

  return (
    <div className="emails-table-card">
      <div className="emails-table-toolbar">
        <div className="emails-search">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="emails-search-input"
            placeholder="Search booking, transaction…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search payouts"
          />
          {search && (
            <button
              type="button"
              className="emails-search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
        <div className="emails-toolbar-right">
          <select
            className="form-select form-select-sm emails-status-filter"
            value={payoutFilter}
            onChange={(e) => setPayoutFilter(e.target.value as PayoutFilter)}
            aria-label="Filter by payout status"
          >
            {PAYOUT_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={rows.length === 0}
            onClick={handleExportCsv}
          >
            <i className="bi bi-download me-1" aria-hidden="true" />
            Export CSV
          </button>
          <span className="emails-search-count">
            {rows.length} payment{rows.length !== 1 && 's'}
          </span>
        </div>
      </div>

      <div className="emails-table-scroll">
        {loading && rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty">Loading payouts…</span>
          </div>
        ) : error && rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty text-danger">{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty">No booking payments found.</span>
          </div>
        ) : (
          <table className="emails-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Amount</th>
                <th>Transaction</th>
                <th>Paid</th>
                <th>Payout status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="small fw-semibold">
                      {row.booking_unique_id || '—'}
                    </div>
                    <div className="text-muted small">{row.booking_title}</div>
                  </td>
                  <td className="small fw-semibold font-monospace">
                    {formatMoney(row.booking_credit)}
                  </td>
                  <td className="small text-muted">
                    <div>{row.transaction_id || '—'}</div>
                    <div>{row.transaction_status || '—'}</div>
                  </td>
                  <td className="small text-muted">
                    {formatDateTime(row.transaction_date)}
                  </td>
                  <td>
                    {row.payout_sent ? (
                      <span className="badge text-bg-success">
                        Sent {formatDateTime(row.payout_sent_at)}
                      </span>
                    ) : (
                      <span className="badge text-bg-warning">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {error && rows.length > 0 && (
        <p className="text-danger small px-2 pb-2 mb-0">{error}</p>
      )}
    </div>
  )
}

export default ReportsPayoutPage
