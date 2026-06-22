import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchBookingPayoutsPage,
  type BookingPayoutsPage,
  type BookingPayoutRecord,
} from '../../services/bookingPayouts'
import { formatAppDateTime } from '../../lib/formatDateTime'

function formatPaymentMethod(value: string | null | undefined): string {
  return value?.trim() || '—'
}

function formatPaymentAmountAndMethod(
  amount: string | number | null | undefined,
  paymentMethod: string | null | undefined,
): { amountLabel: string; methodLabel: string } {
  return {
    amountLabel: formatMoney(amount),
    methodLabel: formatPaymentMethod(paymentMethod),
  }
}

function formatNotes(value: string | null | undefined): string {
  return value?.trim() || '—'
}

function formatTransactionType(value: string | null | undefined): string {
  const status = (value ?? '').trim().toLowerCase()
  if (status === 'paid') return 'Payment'
  if (status === 'refunded') return 'Refund'
  if (!status) return '—'
  return (value ?? '').trim().replace(/_/g, ' ')
}

function transactionTypeBadgeClass(value: string | null | undefined): string {
  const status = (value ?? '').trim().toLowerCase()
  if (status === 'paid') {
    return 'reports-payment-type-badge reports-payment-type-badge--payment'
  }
  if (status === 'refunded') {
    return 'reports-payment-type-badge reports-payment-type-badge--refund'
  }
  return 'reports-payment-type-badge reports-payment-type-badge--other'
}

function TransactionTypeBadge({ status }: { status: string | null | undefined }) {
  const label = formatTransactionType(status)
  if (label === '—') {
    return <span className="text-muted">—</span>
  }
  return <span className={transactionTypeBadgeClass(status)}>{label}</span>
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildPayoutsCsv(rows: BookingPayoutRecord[]): string {
  const headers = [
    'Quotation ID',
    'Quotation title',
    'Amount / payment method',
    'Notes',
    'Type',
    'Transaction ID',
    'Date',
  ]
  const lines = rows.map((row) => {
    const { amountLabel, methodLabel } = formatPaymentAmountAndMethod(
      row.quotation_credit ?? row.booking_credit,
      row.payment_method,
    )
    return [
      row.quotation_unique_id || row.booking_unique_id || '',
      row.quotation_title || row.booking_title || '',
      methodLabel === '—' ? amountLabel : `${amountLabel} (${methodLabel})`,
      formatNotes(row.notes),
      formatTransactionType(row.transaction_status),
      row.transaction_id || '',
      formatAppDateTime(row.transaction_date),
    ]
  })
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
  const [rowsTotal, setRowsTotal] = useState(0)
  const [rowsPage, setRowsPage] = useState(0)
  const [rowsHasMore, setRowsHasMore] = useState(false)
  const [rowsLoadingMore, setRowsLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowsLoadingMoreRef = useRef(false)
  const rowsScrollRef = useRef<HTMLDivElement | null>(null)
  const rowsSentinelRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadRowsPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (replace) {
      setLoading(true)
    } else {
      if (rowsLoadingMoreRef.current) return
      rowsLoadingMoreRef.current = true
      setRowsLoadingMore(true)
    }
    setError(null)
    try {
      const data: BookingPayoutsPage = await fetchBookingPayoutsPage(pageNum, {
        search: debouncedSearch,
      })
      setRows((prev) => (replace ? data.results : [...prev, ...data.results]))
      setRowsTotal(data.count)
      setRowsPage(pageNum)
      setRowsHasMore(data.next != null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payments received')
      if (replace) setRows([])
    } finally {
      if (replace) {
        setLoading(false)
      } else {
        rowsLoadingMoreRef.current = false
        setRowsLoadingMore(false)
      }
    }
  }, [debouncedSearch])

  const loadRows = useCallback(async () => {
    await loadRowsPage(1, true)
  }, [loadRowsPage])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const loadNextRowsPage = useCallback(() => {
    if (!rowsHasMore || loading || rowsLoadingMore) return
    void loadRowsPage(rowsPage + 1, false)
  }, [rowsHasMore, loading, rowsLoadingMore, rowsPage, loadRowsPage])

  useEffect(() => {
    const sentinel = rowsSentinelRef.current
    const root = rowsScrollRef.current
    if (!sentinel || !rowsHasMore || loading || rowsLoadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextRowsPage()
        }
      },
      { root, rootMargin: '160px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [rows.length, rowsHasMore, loading, rowsLoadingMore, loadNextRowsPage])

  const handleExportCsv = () => {
    if (rows.length === 0) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`payments-received-${stamp}.csv`, buildPayoutsCsv(rows))
  }

  return (
    <div className="emails-table-card">
      <div className="emails-table-toolbar">
        <div className="emails-search">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="emails-search-input"
            placeholder="Search quotation, transaction…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search payments received"
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
            {rowsTotal > 0
              ? `${rows.length} of ${rowsTotal} payments`
              : `${rows.length} payment${rows.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      <div ref={rowsScrollRef} className="emails-table-scroll">
        {loading && rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty">Loading payments received…</span>
          </div>
        ) : error && rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty text-danger">{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty">No payments received found.</span>
          </div>
        ) : (
          <table className="emails-table">
            <thead>
              <tr>
                <th>Quotation</th>
                <th>Payment</th>
                <th>Notes</th>
                <th>Type</th>
                <th>Transaction</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { amountLabel, methodLabel } = formatPaymentAmountAndMethod(
                  row.quotation_credit ?? row.booking_credit,
                  row.payment_method,
                )
                return (
                <tr key={row.id}>
                  <td>
                    <div className="small fw-semibold">
                      {row.quotation_unique_id || row.booking_unique_id || '—'}
                    </div>
                    <div className="text-muted small">
                      {row.quotation_title || row.booking_title || '—'}
                    </div>
                  </td>
                  <td>
                    <div className="small fw-semibold font-monospace">{amountLabel}</div>
                    <div className="text-muted small">{methodLabel}</div>
                  </td>
                  <td className="small text-muted">
                    {formatNotes(row.notes)}
                  </td>
                  <td>
                    <TransactionTypeBadge status={row.transaction_status} />
                  </td>
                  <td className="small text-muted font-monospace">
                    {row.transaction_id || '—'}
                  </td>
                  <td className="small text-muted">
                    {formatAppDateTime(row.transaction_date)}
                  </td>
                </tr>
                )
              })}
              {rowsHasMore && rows.length > 0 && (
                <tr ref={rowsSentinelRef} className="emails-list-sentinel" aria-hidden="true">
                  <td colSpan={6} />
                </tr>
              )}
              {rowsLoadingMore && (
                <tr className="emails-list-end">
                  <td colSpan={6} className="emails-table-empty">
                    Loading more payments received…
                  </td>
                </tr>
              )}
              {!rowsHasMore && rows.length > 0 && !loading && (
                <tr className="emails-list-end">
                  <td colSpan={6} className="emails-table-empty">
                    All {rowsTotal} payments loaded
                  </td>
                </tr>
              )}
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
