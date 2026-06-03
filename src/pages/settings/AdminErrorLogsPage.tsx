import { useCallback, useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import {
  fetchAdminErrorLog,
  fetchAdminErrorLogs,
  resolveAdminErrorLog,
  type AdminErrorLogDetailRecord,
  type AdminErrorLogFilters,
  type AdminErrorLogRecord,
} from '../../services/adminErrorLogs'
import { showErrorToast, showSuccessToast } from '../../utils/toast'
import { formatAppDateTime } from '../../lib/formatDateTime'

const METHOD_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]

const STATUS_CODE_OPTIONS = [
  { value: '', label: 'All status codes' },
  { value: '400', label: '400' },
  { value: '401', label: '401' },
  { value: '403', label: '403' },
  { value: '404', label: '404' },
  { value: '405', label: '405' },
  { value: '408', label: '408' },
  { value: '409', label: '409' },
  { value: '422', label: '422' },
  { value: '429', label: '429' },
  { value: '500', label: '500' },
  { value: '502', label: '502' },
  { value: '503', label: '503' },
  { value: '504', label: '504' },
]

const TIME_RANGE_OPTIONS = [
  { value: '', label: 'Custom range' },
  { value: '1m', label: 'Last 1 min' },
  { value: '5m', label: 'Last 5 mins' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '12h', label: 'Last 12 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 2 weeks' },
  { value: '30d', label: 'Last month' },
]
const MODAL_TEXT_MAX = 1200

function truncate(text: string, max = 120): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed || '—'
  return `${trimmed.slice(0, max)}…`
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const AdminErrorLogsPage = () => {
  const { canWrite: errorLogsWrite } = useFeatureAccess('admin_error_logs')
  const [rows, setRows] = useState<AdminErrorLogRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [statusCodeFilter, setStatusCodeFilter] = useState('')
  const [occurredFrom, setOccurredFrom] = useState('')
  const [occurredTo, setOccurredTo] = useState('')
  const [timeRangePreset, setTimeRangePreset] = useState('')
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [selectedLog, setSelectedLog] = useState<AdminErrorLogDetailRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLTableRowElement>(null)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const filters = useCallback(
    (): AdminErrorLogFilters => ({
      search: debouncedSearch,
      method: methodFilter,
      status_code: statusCodeFilter,
      occurred_from: occurredFrom,
      occurred_to: occurredTo,
    }),
    [
      debouncedSearch,
      methodFilter,
      statusCodeFilter,
      occurredFrom,
      occurredTo,
    ],
  )

  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) {
        setLoading(true)
        setError(null)
      } else {
        if (loadingMoreRef.current) return
        loadingMoreRef.current = true
        setLoadingMore(true)
      }
      try {
        const data = await fetchAdminErrorLogs(filters(), pageNum)
        setTotalCount(data.count)
        setHasMore(data.next !== null)
        setPage(pageNum)
        setRows((prev) =>
          replace ? data.results : [...prev, ...data.results],
        )
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to load error logs'
        if (replace) {
          setError(message)
          setRows([])
          setTotalCount(0)
          setHasMore(false)
          setPage(0)
        } else {
          showErrorToast(message)
        }
      } finally {
        if (replace) {
          setLoading(false)
        } else {
          loadingMoreRef.current = false
          setLoadingMore(false)
        }
      }
    },
    [filters],
  )

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  const loadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    void loadPage(page + 1, false)
  }, [hasMore, loadPage, loading, loadingMore, page])

  const maybeLoadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    const root = scrollRootRef.current
    const containerHasVerticalScroll =
      !!root && root.scrollHeight > root.clientHeight + 1
    const nearContainerBottom =
      !!root &&
      root.scrollTop + root.clientHeight >= root.scrollHeight - 12
    const pageRoot = document.documentElement
    const nearPageBottom =
      window.innerHeight + window.scrollY >= pageRoot.scrollHeight - 12
    if (
      (containerHasVerticalScroll && nearContainerBottom) ||
      (!containerHasVerticalScroll && nearPageBottom)
    ) {
      loadNextPage()
    }
  }, [hasMore, loadNextPage, loading, loadingMore])

  const handleLogsScroll = useCallback(() => {
    maybeLoadNextPage()
  }, [maybeLoadNextPage])

  useEffect(() => {
    window.addEventListener('scroll', maybeLoadNextPage, { passive: true })
    return () => window.removeEventListener('scroll', maybeLoadNextPage)
  }, [maybeLoadNextPage])

  const handleResolve = async (row: AdminErrorLogRecord) => {
    if (!errorLogsWrite || row.is_resolved) return
    const result = await Swal.fire({
      title: 'Mark as resolved?',
      text: 'This marks the error log as resolved.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Resolve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#198754',
    })
    if (!result.isConfirmed) return
    setResolvingId(row.id)
    try {
      const updated = await resolveAdminErrorLog(row.id)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
      showSuccessToast('Error log marked as resolved.')
    } catch (e) {
      showErrorToast(
        e instanceof Error ? e.message : 'Failed to mark error as resolved',
      )
    } finally {
      setResolvingId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setMethodFilter('')
    setStatusCodeFilter('')
    setOccurredFrom('')
    setOccurredTo('')
    setTimeRangePreset('')
  }

  const applyTimeRangePreset = (preset: string) => {
    setTimeRangePreset(preset)
    if (!preset) return
    const now = new Date()
    const from = new Date(now)
    switch (preset) {
      case '1m':
        from.setMinutes(from.getMinutes() - 1)
        break
      case '5m':
        from.setMinutes(from.getMinutes() - 5)
        break
      case '1h':
        from.setHours(from.getHours() - 1)
        break
      case '6h':
        from.setHours(from.getHours() - 6)
        break
      case '12h':
        from.setHours(from.getHours() - 12)
        break
      case '24h':
        from.setHours(from.getHours() - 24)
        break
      case '7d':
        from.setDate(from.getDate() - 7)
        break
      case '14d':
        from.setDate(from.getDate() - 14)
        break
      case '30d':
        from.setDate(from.getDate() - 30)
        break
      default:
        return
    }
    setOccurredFrom(toDatetimeLocalValue(from))
    setOccurredTo(toDatetimeLocalValue(now))
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    methodFilter !== '' ||
    statusCodeFilter.trim() !== '' ||
    occurredFrom !== '' ||
    occurredTo !== ''

  const countLabel =
    totalCount > 0
      ? `${rows.length} of ${totalCount} log${totalCount !== 1 ? 's' : ''}`
      : `${rows.length} log${rows.length !== 1 ? 's' : ''}`

  const openLogDetail = useCallback(async (id: number) => {
    setSelectedLogId(id)
    setDetailLoading(true)
    setDetailError(null)
    try {
      const detail = await fetchAdminErrorLog(id)
      setSelectedLog(detail)
    } catch (e) {
      setSelectedLog(null)
      setDetailError(e instanceof Error ? e.message : 'Failed to load error log')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeLogDetail = () => {
    setSelectedLogId(null)
    setSelectedLog(null)
    setDetailError(null)
    setDetailLoading(false)
  }

  const modalText = (value: string | null | undefined): string => {
    const text = (value || '').trim()
    if (!text) return '—'
    return truncate(text, MODAL_TEXT_MAX)
  }

  const handleOpenRow = (id: number) => {
    void openLogDetail(id)
  }

  const copyToClipboard = async (label: string, value: string | null | undefined) => {
    const text = (value || '').trim()
    if (!text) {
      showErrorToast(`No ${label} to copy.`)
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      showSuccessToast(`${label} copied.`)
    } catch {
      showErrorToast(`Failed to copy ${label}.`)
    }
  }

  return (
    <>
      <p className="text-muted small mb-3">
        API and server errors captured by the platform, newest first. Filter by
        method, status code, date, or search the error message. Scroll to load
        more.
      </p>

      <div className="emails-table-card">
        <div className="admin-error-logs-toolbar">
          <div className="emails-search admin-error-logs-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              className="emails-search-input"
              placeholder="Search error message, type, or path…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search error logs"
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
          <select
            className="form-select form-select-sm admin-error-logs-filter"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            aria-label="Filter by HTTP method"
          >
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm admin-error-logs-filter"
            value={statusCodeFilter}
            onChange={(e) => setStatusCodeFilter(e.target.value)}
            aria-label="Filter by status code"
          >
            {STATUS_CODE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm admin-error-logs-filter"
            value={timeRangePreset}
            onChange={(e) => applyTimeRangePreset(e.target.value)}
            aria-label="Quick time range"
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value || 'custom'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            className="form-control form-control-sm admin-error-logs-filter"
            value={occurredFrom}
            onChange={(e) => {
              setOccurredFrom(e.target.value)
              if (timeRangePreset) setTimeRangePreset('')
            }}
            aria-label="Occurred from date and time"
            title="From date and time"
          />
          <input
            type="datetime-local"
            className="form-control form-control-sm admin-error-logs-filter"
            value={occurredTo}
            onChange={(e) => {
              setOccurredTo(e.target.value)
              if (timeRangePreset) setTimeRangePreset('')
            }}
            aria-label="Occurred to date and time"
            title="To date and time"
          />
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
          <span className="emails-search-count ms-auto">{countLabel}</span>
        </div>

        <div
          ref={scrollRootRef}
          className="emails-table-scroll admin-error-logs-scroll"
          onScroll={handleLogsScroll}
        >
          {loading && rows.length === 0 ? (
            <div className="emails-table-empty-wrap">
              <span className="emails-table-empty">Loading error logs…</span>
            </div>
          ) : error ? (
            <div className="emails-table-empty-wrap">
              <span className="emails-table-empty emails-table-error">{error}</span>
            </div>
          ) : (
            <table className="emails-table">
              <thead>
                <tr>
                  <th className="admin-error-logs-col-method">Method</th>
                  <th className="admin-error-logs-col-status">Status</th>
                  <th>Error</th>         
                  <th className="admin-error-logs-th-actions">Actions</th>
                  <th className="admin-error-logs-th-resolved">Resolved</th>         
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="emails-table-empty">
                      No error logs match your filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="emails-table-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenRow(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleOpenRow(row.id)
                        }
                      }}
                    >
                      <td className="admin-error-logs-col-method" onClick={() => handleOpenRow(row.id)}>
                        <span className="badge text-bg-secondary">{row.method}</span>
                      </td>
                      <td className="admin-error-logs-col-status" onClick={() => handleOpenRow(row.id)}>
                        {row.status_code ?? '—'}
                      </td>
                      <td
                        className="small admin-error-logs-col-error"
                        title={row.exception_message}
                        onClick={() => handleOpenRow(row.id)}
                      >
                        <div className="text-muted admin-error-logs-when">
                          {formatAppDateTime(row.created_at)}
                        </div>
                        <div className="admin-error-logs-path" title={row.path}>
                          {truncate(row.path, 120)}
                        </div>
                        <div>{row.exception_type || '—'}</div>
                        <div className="text-muted">
                          {truncate(row.exception_message, 120)}
                        </div>
                      </td>
                      <td onClick={() => handleOpenRow(row.id)}>
                        {row.is_resolved ? (
                          <span className="badge text-bg-success">Yes</span>
                        ) : (
                          <span className="badge text-bg-warning">Open</span>
                        )}
                      </td>
                      <td className="emails-td-actions">
                        {!row.is_resolved && errorLogsWrite && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            disabled={resolvingId === row.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleResolve(row)
                            }}
                          >
                            {resolvingId === row.id ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              />
                            ) : (
                              'Resolved'
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
                {hasMore && rows.length > 0 && (
                  <tr ref={sentinelRef} className="admin-error-logs-sentinel">
                    <td colSpan={5} className="text-center text-muted small py-3">
                      {loadingMore ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          />
                          Loading more…
                        </>
                      ) : (
                        'Scroll for more'
                      )}
                    </td>
                  </tr>
                )}
                {!hasMore && rows.length > 0 && !loading && (
                  <tr className="admin-error-logs-end">
                    <td colSpan={5} className="text-center text-muted small py-3">
                      All {totalCount} error log{totalCount !== 1 ? 's' : ''} {totalCount !== 1 ? 'have' : 'has'} been loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedLogId != null && (
        <>
          <div
            className="user-details-modal-backdrop modal-backdrop fade show"
            aria-hidden="true"
            onClick={closeLogDetail}
          />
          <div
            className="user-details-modal modal fade show d-block"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Error log #{selectedLogId}</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeLogDetail}
                  />
                </div>
                <div className="modal-body">
                  {detailLoading ? (
                    <p className="text-muted small mb-0">Loading error details...</p>
                  ) : detailError ? (
                    <p className="text-danger small mb-0">{detailError}</p>
                  ) : selectedLog ? (
                    <div className="small">
                      <div><strong>Method:</strong> {selectedLog.method}</div>
                      <div><strong>Path:</strong> {modalText(selectedLog.path)}</div>
                      <div><strong>Query string:</strong> {modalText(selectedLog.query_string)}</div>
                      <div><strong>Status code:</strong> {selectedLog.status_code ?? '—'}</div>
                      <div><strong>Exception type:</strong> {modalText(selectedLog.exception_type)}</div>
                      <div><strong>Exception message:</strong> {modalText(selectedLog.exception_message)}</div>
                      <div><strong>User:</strong> {selectedLog.user_email || selectedLog.user || '—'}</div>
                      <div><strong>Account:</strong> {selectedLog.account_name || selectedLog.account || '—'}</div>
                      <div><strong>IP address:</strong> {selectedLog.ip_address || '—'}</div>
                      <div><strong>Created:</strong> {formatAppDateTime(selectedLog.created_at)}</div>
                      <div><strong>Resolved at:</strong> {formatAppDateTime(selectedLog.resolved_at)}</div>
                      <hr />
                      <div className="mb-2">
                        <strong>User agent</strong>
                        <pre className="mb-0 mt-1 bg-light p-2 rounded border text-wrap">{modalText(selectedLog.user_agent)}</pre>
                      </div>
                      <div className="mb-2">
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <strong>Request body</strong>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                            onClick={() => void copyToClipboard('Request body', selectedLog.request_body)}
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="mb-0 mt-1 bg-light p-2 rounded border text-wrap">{modalText(selectedLog.request_body)}</pre>
                      </div>
                      <div>
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <strong>Traceback</strong>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                            onClick={() => void copyToClipboard('Traceback', selectedLog.traceback)}
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="mb-0 mt-1 bg-light p-2 rounded border text-wrap">{modalText(selectedLog.traceback)}</pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default AdminErrorLogsPage
