import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchAdminAccountsPage,
  type AdminAccountsPage as AdminAccountsPageResponse,
  type AdminAccountRecord,
} from '../../services/adminAccounts'
import { formatAppDateTime } from '../../lib/formatDateTime'

const AdminAccountsPage = () => {
  const [rows, setRows] = useState<AdminAccountRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedAccountIds, setExpandedAccountIds] = useState<Set<number>>(new Set())

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
      const data: AdminAccountsPageResponse = await fetchAdminAccountsPage(pageNum, debouncedSearch)
      setRows((prev) => (replace ? data.results : [...prev, ...data.results]))
      setTotalCount(data.count)
      setPage(pageNum)
      setHasMore(data.next != null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load accounts'
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
  }, [debouncedSearch])

  useEffect(() => {
    void loadPage(1, true)
  }, [loadPage])

  useEffect(() => {
    setExpandedAccountIds(new Set())
  }, [debouncedSearch])

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

  const toggleExpanded = (accountId: number) => {
    setExpandedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  return (
    <>
      <p className="text-muted small mb-3">
        All tenant accounts on the platform, newest first. Search by name,
        contact, or account id.
      </p>

      <div className="emails-table-card">
        <div className="emails-table-toolbar">
          <div className="emails-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              className="emails-search-input"
              placeholder="Search name, contact, or id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search accounts"
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
            <span className="emails-search-count">
              {totalCount > 0
                ? `${rows.length} of ${totalCount} accounts`
                : `${rows.length} account${rows.length !== 1 ? 's' : ''}`}
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
              <span className="emails-table-empty">Loading accounts…</span>
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
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Country</th>
                  <th>Companies</th>
                  <th>Users</th>
                  <th>Active</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="emails-table-empty">
                      No accounts match your search.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr key={row.id} className="emails-table-row">
                        <td className="emails-table-id">{row.id}</td>
                        <td className="fw-semibold">{row.name}</td>
                        <td>
                          <div className="small">{row.contact_person || '—'}</div>
                          {row.contact_email ? (
                            <div className="text-muted small">{row.contact_email}</div>
                          ) : null}
                          {row.contact_mobile_number ? (
                            <div className="text-muted small">
                              {row.contact_mobile_number}
                            </div>
                          ) : null}
                        </td>
                        <td>{row.country_name || '—'}</td>
                        <td>{row.company_count}</td>
                        <td>{row.user_count}</td>
                        <td>
                          <span
                            className={`badge ${
                              row.is_active ? 'text-bg-success' : 'text-bg-secondary'
                            }`}
                          >
                            {row.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{formatAppDateTime(row.created_at)}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => toggleExpanded(row.id)}
                            aria-expanded={expandedAccountIds.has(row.id)}
                            aria-label={
                              expandedAccountIds.has(row.id)
                                ? `Collapse ${row.name}`
                                : `Expand ${row.name}`
                            }
                          >
                            <i
                              className={`bi ${
                                expandedAccountIds.has(row.id)
                                  ? 'bi-caret-up-fill'
                                  : 'bi-caret-down-fill'
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        </td>
                      </tr>
                      {expandedAccountIds.has(row.id) && (
                        <tr className="emails-table-row">
                          <td colSpan={9} className="bg-light">
                            {row.companies.length === 0 ? (
                              <div className="small text-muted px-2 py-1">No companies under this account.</div>
                            ) : (
                              <div className="table-responsive">
                                <table className="table table-sm mb-0 align-middle">
                                  <thead>
                                    <tr>
                                      <th>Company name</th>
                                      <th>Is main</th>
                                      <th>Contact person</th>
                                      <th>Contact email</th>
                                      <th>KYB verified</th>
                                      <th>Users</th>
                                      <th>Max booking per day</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.companies.map((company) => (
                                      <tr key={company.id}>
                                        <td>{company.name}</td>
                                        <td>{company.is_main ? 'Yes' : 'No'}</td>
                                        <td>{company.contact_person || '—'}</td>
                                        <td>{company.contact_email || '—'}</td>
                                        <td>{company.kyb_verified ? 'Yes' : 'No'}</td>
                                        <td>{company.user_count}</td>
                                        <td>{company.max_booking_per_day ?? '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
                {hasMore && rows.length > 0 && (
                  <tr className="emails-list-sentinel">
                    <td colSpan={9} className="text-center text-muted small py-3">
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
                    <td colSpan={9} className="emails-table-empty">
                      All {totalCount} account{totalCount !== 1 ? 's have' : ' has'} been loaded.
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

export default AdminAccountsPage
