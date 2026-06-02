import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import {
  fetchAdminErrorLogs,
  resolveAdminErrorLog,
  type AdminErrorLogFilters,
  type AdminErrorLogRecord,
} from '../../services/adminErrorLogs'
import { showErrorToast, showSuccessToast } from '../../utils/toast'

const METHOD_OPTIONS = [
  { value: '', label: 'All methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function truncate(text: string, max = 120): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed || '—'
  return `${trimmed.slice(0, max)}…`
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
  const [resolvingId, setResolvingId] = useState<number | null>(null)

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

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRootRef.current
    if (!sentinel || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextPage()
        }
      },
      { root, rootMargin: '160px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadNextPage, loading, loadingMore, rows.length])

  const handleResolve = async (row: AdminErrorLogRecord) => {
    if (!errorLogsWrite || row.is_resolved) return
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
          <input
            type="number"
            className="form-control form-control-sm admin-error-logs-filter"
            placeholder="Status code"
            min={100}
            max={599}
            value={statusCodeFilter}
            onChange={(e) => setStatusCodeFilter(e.target.value)}
            aria-label="Filter by status code"
          />
          <input
            type="date"
            className="form-control form-control-sm admin-error-logs-filter"
            value={occurredFrom}
            onChange={(e) => setOccurredFrom(e.target.value)}
            aria-label="Occurred from date"
            title="From date"
          />
          <input
            type="date"
            className="form-control form-control-sm admin-error-logs-filter"
            value={occurredTo}
            onChange={(e) => setOccurredTo(e.target.value)}
            aria-label="Occurred to date"
            title="To date"
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
                    <tr key={row.id} className="emails-table-row">
                      <td className="admin-error-logs-col-method">
                        <span className="badge text-bg-secondary">{row.method}</span>
                      </td>
                      <td className="admin-error-logs-col-status">{row.status_code ?? '—'}</td>
                      <td className="small admin-error-logs-col-error" title={row.exception_message}>
                        <div className="text-muted admin-error-logs-when">
                          {formatDateTime(row.created_at)}
                        </div>
                        <div className="admin-error-logs-path" title={row.path}>
                          {truncate(row.path, 120)}
                        </div>
                        <div>{row.exception_type || '—'}</div>
                        <div className="text-muted">
                          {truncate(row.exception_message, 120)}
                        </div>
                      </td>
                      <td>
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
                            onClick={() => void handleResolve(row)}
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
    </>
  )
}

export default AdminErrorLogsPage
