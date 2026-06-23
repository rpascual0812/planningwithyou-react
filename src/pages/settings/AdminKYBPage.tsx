import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import AdminKybReviewModal from './AdminKybReviewModal'
import {
  fetchAdminKybVerificationsPage,
  type AdminKybVerificationsPage,
  type AdminKybStatusFilter,
  type CompanyKybListRecord,
} from '../../services/adminCompanyKyb'
import type { PaymongoKybStatus, XenditKybStatus } from '../../services/companyKyb'
import { formatAppDateTime } from '../../lib/formatDateTime'

const STATUS_OPTIONS: { value: AdminKybStatusFilter; label: string }[] = [
  { value: 'all', label: 'Pending or approved (any provider)' },
  { value: 'pending_paymongo', label: 'Pending PayMongo' },
  { value: 'pending_xendit', label: 'Pending Xendit' },
  { value: 'approved_paymongo', label: 'Approved PayMongo' },
  { value: 'approved_xendit', label: 'Approved Xendit' },
  { value: 'approved', label: 'Approved (any provider)' },
]

const PAYMONGO_STATUS_BADGE: Record<PaymongoKybStatus, string> = {
  draft: 'text-bg-secondary',
  pending_paymongo: 'text-bg-warning',
  approved: 'text-bg-success',
  rejected: 'text-bg-danger',
}

const XENDIT_STATUS_BADGE: Record<XenditKybStatus, string> = {
  draft: 'text-bg-secondary',
  pending_xendit: 'text-bg-warning',
  approved: 'text-bg-success',
  rejected: 'text-bg-danger',
}

const PAYMONGO_STATUS_LABEL: Record<PaymongoKybStatus, string> = {
  draft: 'Not started',
  pending_paymongo: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const XENDIT_STATUS_LABEL: Record<XenditKybStatus, string> = {
  draft: 'Not started',
  pending_xendit: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

function providerStatusBadge(
  provider: 'paymongo' | 'xendit',
  status: PaymongoKybStatus | XenditKybStatus,
) {
  const badgeClass =
    provider === 'paymongo'
      ? (PAYMONGO_STATUS_BADGE[status as PaymongoKybStatus] ?? 'text-bg-secondary')
      : (XENDIT_STATUS_BADGE[status as XenditKybStatus] ?? 'text-bg-secondary')
  const label =
    provider === 'paymongo'
      ? (PAYMONGO_STATUS_LABEL[status as PaymongoKybStatus] ?? status)
      : (XENDIT_STATUS_LABEL[status as XenditKybStatus] ?? status)
  return (
    <span className={`badge ${badgeClass}`} title={status}>
      {label}
    </span>
  )
}

function startedAt(row: CompanyKybListRecord): string {
  const paymongo = row.submitted_at
  const xendit = row.xendit_submitted_at
  if (paymongo && xendit) {
    return formatAppDateTime(
      new Date(paymongo) <= new Date(xendit) ? paymongo : xendit,
    )
  }
  return formatAppDateTime(paymongo ?? xendit)
}

const AdminKYBPage = () => {
  const { canWrite: kybWrite } = useFeatureAccess('admin_company_verification')
  const [rows, setRows] = useState<CompanyKybListRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AdminKybStatusFilter>('all')
  const [selected, setSelected] = useState<CompanyKybListRecord | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadingMoreRef = useRef(false)
  const scrollRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (replace) {
      setLoading(true)
      setError(null)
    } else {
      if (loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    try {
      const data: AdminKybVerificationsPage = await fetchAdminKybVerificationsPage(
        pageNum,
        statusFilter,
        debouncedSearch,
      )
      setRows((prev) => (replace ? data.results : [...prev, ...data.results]))
      setTotalCount(data.count)
      setPage(pageNum)
      setHasMore(data.next != null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load verifications'
      if (replace) {
        setError(message)
        setRows([])
        setTotalCount(0)
        setPage(0)
        setHasMore(false)
      }
    } finally {
      if (replace) {
        setLoading(false)
      } else {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
    }
  }, [statusFilter, debouncedSearch])

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  const loadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    void loadPage(page + 1, false)
  }, [hasMore, loading, loadingMore, page, loadPage])

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
  }, [hasMore, loading, loadingMore, loadNextPage])

  const handleRowsScroll = useCallback(() => {
    maybeLoadNextPage()
  }, [maybeLoadNextPage])

  useEffect(() => {
    window.addEventListener('scroll', maybeLoadNextPage, { passive: true })
    return () => window.removeEventListener('scroll', maybeLoadNextPage)
  }, [maybeLoadNextPage])

  return (
    <>
      <p className="text-muted small mb-3">
        Companies appear here once PayMongo or Xendit verification has been
        started and is pending or approved. Companies that have not started KYB
        on either provider are not listed.
      </p>

      <div className="emails-table-card">
        <div className="emails-table-toolbar">
          <div className="emails-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              className="emails-search-input"
              placeholder="Search company, business name, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search KYB verifications"
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
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as AdminKybStatusFilter)
              }
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="emails-search-count">
              {totalCount > 0
                ? `${rows.length} of ${totalCount} verifications`
                : `${rows.length} verification${rows.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        <div
          ref={scrollRootRef}
          className="emails-table-scroll"
          onScroll={handleRowsScroll}
        >
          {loading && rows.length === 0 ? (
            <div className="emails-table-empty-wrap">
              <span className="emails-table-empty">Loading verifications…</span>
            </div>
          ) : error ? (
            <div className="emails-table-empty-wrap">
              <span className="emails-table-empty emails-table-error">{error}</span>
            </div>
          ) : (
            <table className="emails-table">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Company</th>
                  <th>Business</th>
                  <th>PayMongo</th>
                  <th>Xendit</th>
                  <th>Started</th>
                  <th>Reviewed</th>
                  <th className="emails-th-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="emails-table-empty">
                      No verifications for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="emails-table-row">
                      <td className="emails-table-id">{row.id}</td>
                      <td>{row.company_name}</td>
                      <td>
                        <div className="small">
                          {row.merchant_business_name || '—'}
                        </div>
                        {row.merchant_email ? (
                          <div className="text-muted small">{row.merchant_email}</div>
                        ) : null}
                      </td>
                      <td>{providerStatusBadge('paymongo', row.paymongo_status)}</td>
                      <td>{providerStatusBadge('xendit', row.xendit_status)}</td>
                      <td>{startedAt(row)}</td>
                      <td>{formatAppDateTime(row.reviewed_at)}</td>
                      <td className="emails-table-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => setSelected(row)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {hasMore && rows.length > 0 && (
                  <tr className="emails-list-sentinel">
                    <td colSpan={8} className="text-center text-muted small py-3">
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
                {!hasMore && rows.length > 0 && !loading && (
                  <tr className="emails-list-end">
                    <td colSpan={8} className="emails-table-empty">
                      All {totalCount} verification{totalCount !== 1 ? 's have' : ' has'} been loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <AdminKybReviewModal
          verificationId={selected.id}
          companyName={selected.company_name}
          canApprove={kybWrite}
          onClose={() => setSelected(null)}
          onApproved={() => void loadPage(1, true)}
        />
      )}
    </>
  )
}

export default AdminKYBPage
