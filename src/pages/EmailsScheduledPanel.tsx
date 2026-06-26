import { useCallback, useEffect, useRef, useState } from 'react'
import CompanyFilterSelect from '../components/CompanyFilterSelect'
import { useCompanyFilter } from '../hooks/useCompanyFilter'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import { formatAppDateTime } from '../lib/formatDateTime'
import {
  cancelScheduledReminder,
  fetchScheduledRemindersPage,
  formatScheduledReminderOffset,
  restoreScheduledReminder,
  type ScheduledReminderRecord,
} from '../services/scheduledReminderEmails'
import { showErrorToast, showSuccessToast } from '../utils/toast'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const TIMING_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'future', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

const statusBadge = (row: ScheduledReminderRecord) => {
  const cancelled = row.deleted_at != null
  const status = cancelled ? 'cancelled' : row.status
  const cls =
    status === 'sent'
      ? 'emails-status--sent'
      : status === 'failed'
        ? 'emails-status--failed'
        : status === 'cancelled'
          ? 'emails-status--failed'
          : 'emails-status--queued'
  const label = cancelled ? 'cancelled' : row.status
  return <span className={`emails-status ${cls}`}>{label}</span>
}

const isFuturePending = (row: ScheduledReminderRecord) =>
  row.status === 'pending' &&
  row.deleted_at == null &&
  new Date(row.send_at).getTime() > Date.now()

const EmailsScheduledPanel = () => {
  const { canWrite: emailsWrite } = useFeatureAccess('emails')
  const [error, setError] = useState<string | null>(null)
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
  } = useCompanyFilter({ onFetchError: setError })

  const [rows, setRows] = useState<ScheduledReminderRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [timingFilter, setTimingFilter] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingMoreRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (activeCompanyId == null) {
        if (replace) {
          setRows([])
          setTotal(0)
          setPage(0)
          setHasMore(false)
          setLoading(false)
        }
        return
      }
      if (replace) {
        setLoading(true)
      } else {
        if (loadingMoreRef.current) return
        loadingMoreRef.current = true
        setLoadingMore(true)
      }
      setError(null)
      try {
        const data = await fetchScheduledRemindersPage(pageNum, {
          companyId: activeCompanyId,
          search: debouncedSearch,
          status: statusFilter,
          timing: timingFilter,
          includeDeleted,
        })
        setRows((prev) => (replace ? data.results : [...prev, ...data.results]))
        setTotal(data.count)
        setPage(pageNum)
        setHasMore(data.next != null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load scheduled reminders')
      } finally {
        if (replace) {
          setLoading(false)
        } else {
          loadingMoreRef.current = false
          setLoadingMore(false)
        }
      }
    },
    [
      activeCompanyId,
      debouncedSearch,
      statusFilter,
      timingFilter,
      includeDeleted,
    ],
  )

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  const loadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    void loadPage(page + 1, false)
  }, [hasMore, loading, loadingMore, page, loadPage])

  const maybeLoadNext = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    const root = scrollRef.current
    const containerHasScroll =
      !!root && root.scrollHeight > root.clientHeight + 1
    const nearBottom =
      !!root && root.scrollTop + root.clientHeight >= root.scrollHeight - 12
    const nearPageBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 12
    if (
      (containerHasScroll && nearBottom) ||
      (!containerHasScroll && nearPageBottom)
    ) {
      loadNextPage()
    }
  }, [hasMore, loading, loadingMore, loadNextPage])

  useEffect(() => {
    window.addEventListener('scroll', maybeLoadNext, { passive: true })
    return () => window.removeEventListener('scroll', maybeLoadNext)
  }, [maybeLoadNext])

  const handleCancel = async (row: ScheduledReminderRecord) => {
    if (!emailsWrite || !isFuturePending(row)) return
    setActionId(row.id)
    try {
      await cancelScheduledReminder(row.id)
      showSuccessToast('Reminder cancelled.')
      await loadPage(1, true)
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setActionId(null)
    }
  }

  const handleRestore = async (row: ScheduledReminderRecord) => {
    if (!emailsWrite || row.deleted_at == null || row.status !== 'pending') return
    if (new Date(row.send_at).getTime() <= Date.now()) return
    setActionId(row.id)
    try {
      await restoreScheduledReminder(row.id)
      showSuccessToast('Reminder restored.')
      await loadPage(1, true)
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Restore failed')
    } finally {
      setActionId(null)
    }
  }

  const companyTz =
    companies.find((c) => c.id === activeCompanyId)?.timezone ?? undefined

  return (
    <>
      <div className="row g-2 align-items-end mb-3 px-2 pt-2">
        <CompanyFilterSelect
          id="emails-scheduled-company"
          companies={companies}
          loading={companiesLoading}
          value={selectedCompanyId}
          onChange={setSelectedCompanyId}
        />
      </div>
      <div className="emails-table-toolbar">
        <div className="emails-search">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="emails-search-input"
            placeholder="Search scheduled reminders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search scheduled reminders"
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
            value={timingFilter}
            onChange={(e) => setTimingFilter(e.target.value)}
            aria-label="Filter by timing"
          >
            {TIMING_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="form-select form-select-sm emails-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className="form-check-label small text-muted d-flex align-items-center gap-1 mb-0">
            <input
              type="checkbox"
              className="form-check-input mt-0"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            Show cancelled
          </label>
          <span className="emails-search-count">
            {total > 0
              ? `${rows.length} of ${total} reminders`
              : `${rows.length} reminder${rows.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="emails-table-scroll"
        onScroll={maybeLoadNext}
      >
        {loading && rows.length === 0 ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty">Loading scheduled reminders...</span>
          </div>
        ) : error ? (
          <div className="emails-table-empty-wrap">
            <span className="emails-table-empty emails-table-error">{error}</span>
          </div>
        ) : (
          <table className="emails-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Recipient</th>
                <th>When</th>
                <th>Offset</th>
                <th>Status</th>
                <th>Sent at</th>
                <th className="emails-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="emails-table-row">
                  <td>
                    <div className="fw-medium">{row.event_title || '—'}</div>
                    <div className="text-muted small">
                      {formatAppDateTime(row.event_start, companyTz)}
                    </div>
                  </td>
                  <td>
                    <div>{row.recipient_name || row.recipient_email}</div>
                    <div className="text-muted small">
                      {row.recipient_role} · {row.recipient_email}
                    </div>
                  </td>
                  <td className="emails-date">
                    {formatAppDateTime(row.send_at, companyTz)}
                  </td>
                  <td className="text-muted small">
                    {formatScheduledReminderOffset(row)}
                  </td>
                  <td>{statusBadge(row)}</td>
                  <td className="emails-date">
                    {row.sent_at
                      ? formatAppDateTime(row.sent_at, companyTz)
                      : '—'}
                  </td>
                  <td>
                    <div className="emails-actions">
                      {emailsWrite && isFuturePending(row) && (
                        <button
                          type="button"
                          className="emails-action-btn emails-action-view"
                          title="Cancel reminder"
                          disabled={actionId === row.id}
                          onClick={() => void handleCancel(row)}
                        >
                          <i className="bi bi-x-circle" />
                        </button>
                      )}
                      {emailsWrite &&
                        row.deleted_at != null &&
                        row.status === 'pending' &&
                        new Date(row.send_at).getTime() > Date.now() && (
                          <button
                            type="button"
                            className="emails-action-btn emails-action-view"
                            title="Restore reminder"
                            disabled={actionId === row.id}
                            onClick={() => void handleRestore(row)}
                          >
                            <i className="bi bi-arrow-counterclockwise" />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="emails-table-empty">
                    {search || statusFilter || timingFilter || activeCompanyId != null
                      ? 'No scheduled reminders match your filters.'
                      : 'No scheduled reminders yet.'}
                  </td>
                </tr>
              )}
              {hasMore && rows.length > 0 && (
                <tr className="emails-list-sentinel">
                  <td colSpan={7} className="text-center text-muted small py-3">
                    {loadingMore ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Loading more...
                      </>
                    ) : (
                      'Scroll for more'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

export default EmailsScheduledPanel
