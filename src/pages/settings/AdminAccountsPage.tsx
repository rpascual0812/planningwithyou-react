import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchAdminAccountsPage,
  type AdminAccountsPage as AdminAccountsPageResponse,
  type AdminAccountRecord,
} from '../../services/adminAccounts'
import {
  fetchImpersonationUsers,
  startImpersonation,
  type ImpersonationUserRecord,
} from '../../services/impersonation'
import { useAuthSession } from '../../context/AuthSessionContext'
import { formatAppDateTime } from '../../lib/formatDateTime'

function userDisplayName(user: ImpersonationUserRecord): string {
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || user.username || user.email
}

function companyKey(accountId: number, companyId: number): string {
  return `${accountId}:${companyId}`
}

function filterAccountUsers(
  users: ImpersonationUserRecord[],
  query: string,
): ImpersonationUserRecord[] {
  const q = query.trim().toLowerCase()
  if (!q) return users
  return users.filter((user) => {
    const haystack = [
      user.username,
      user.email,
      user.first_name,
      user.last_name,
      user.company_name,
      userDisplayName(user),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

const USERS_PAGE_SIZE = 5

const AdminAccountsPage = () => {
  const navigate = useNavigate()
  const { syncAuthState } = useAuthSession()
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
  const [expandedCompanyKeys, setExpandedCompanyKeys] = useState<Set<string>>(new Set())
  const [companyUsers, setCompanyUsers] = useState<
    Record<string, ImpersonationUserRecord[]>
  >({})
  const [companyUsersLoadingKeys, setCompanyUsersLoadingKeys] = useState<Set<string>>(
    new Set(),
  )
  const [companyUsersError, setCompanyUsersError] = useState<Record<string, string>>({})
  const [impersonatingUserId, setImpersonatingUserId] = useState<number | null>(null)
  const [companyUsersVisibleCount, setCompanyUsersVisibleCount] = useState<
    Record<string, number>
  >({})
  const [companyUserSearch, setCompanyUserSearch] = useState<Record<string, string>>({})

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
    setExpandedCompanyKeys(new Set())
    setCompanyUsers({})
    setCompanyUsersError({})
    setCompanyUsersVisibleCount({})
    setCompanyUserSearch({})
  }, [debouncedSearch])

  const loadCompanyUsers = useCallback(async (accountId: number, companyId: number) => {
    const key = companyKey(accountId, companyId)
    setCompanyUsersLoadingKeys((prev) => new Set(prev).add(key))
    setCompanyUsersError((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      const users = await fetchImpersonationUsers(accountId, companyId)
      setCompanyUsers((prev) => ({ ...prev, [key]: users }))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load users'
      setCompanyUsersError((prev) => ({ ...prev, [key]: message }))
      setCompanyUsers((prev) => ({ ...prev, [key]: [] }))
    } finally {
      setCompanyUsersLoadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [])

  useEffect(() => {
    for (const key of expandedCompanyKeys) {
      if (companyUsers[key] == null && !companyUsersLoadingKeys.has(key)) {
        const [accountId, companyId] = key.split(':').map(Number)
        void loadCompanyUsers(accountId, companyId)
      }
    }
  }, [companyUsers, companyUsersLoadingKeys, expandedCompanyKeys, loadCompanyUsers])

  const handleViewAsUser = async (user: ImpersonationUserRecord) => {
    if (!user.can_impersonate || impersonatingUserId != null) return
    setImpersonatingUserId(user.id)
    try {
      await startImpersonation(user.id)
      syncAuthState()
      navigate('/', { replace: true })
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to start impersonation'
      window.alert(message)
    } finally {
      setImpersonatingUserId(null)
    }
  }

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

  const toggleAccountExpanded = (accountId: number) => {
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

  const toggleCompanyExpanded = (accountId: number, companyId: number) => {
    const key = companyKey(accountId, companyId)
    setExpandedCompanyKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        setCompanyUsersVisibleCount((counts) => ({
          ...counts,
          [key]: USERS_PAGE_SIZE,
        }))
      }
      return next
    })
  }

  const showMoreUsers = (key: string) => {
    setCompanyUsersVisibleCount((prev) => ({
      ...prev,
      [key]: (prev[key] ?? USERS_PAGE_SIZE) + USERS_PAGE_SIZE,
    }))
  }

  const handleCompanyUserSearch = (key: string, value: string) => {
    setCompanyUserSearch((prev) => ({ ...prev, [key]: value }))
    setCompanyUsersVisibleCount((prev) => ({
      ...prev,
      [key]: USERS_PAGE_SIZE,
    }))
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
                      <tr className="emails-table-row">
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
                            onClick={() => toggleAccountExpanded(row.id)}
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
                              <div className="small text-muted px-2 py-1">
                                No companies under this account.
                              </div>
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
                                      <th />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.companies.map((company) => {
                                      const key = companyKey(row.id, company.id)
                                      const isCompanyExpanded = expandedCompanyKeys.has(key)
                                      const allCompanyUsers = companyUsers[key] ?? []
                                      const userSearch = companyUserSearch[key] ?? ''
                                      const filteredCompanyUsers = filterAccountUsers(
                                        allCompanyUsers,
                                        userSearch,
                                      )
                                      const visibleUserCount =
                                        companyUsersVisibleCount[key] ?? USERS_PAGE_SIZE
                                      const visibleCompanyUsers = filteredCompanyUsers.slice(
                                        0,
                                        visibleUserCount,
                                      )
                                      const hasMoreCompanyUsers =
                                        filteredCompanyUsers.length > visibleUserCount
                                      const usersLoaded = companyUsers[key] != null
                                      const usersLoading = companyUsersLoadingKeys.has(key)

                                      return (
                                        <Fragment key={company.id}>
                                          <tr>
                                            <td className="fw-semibold">{company.name}</td>
                                            <td>{company.is_main ? 'Yes' : 'No'}</td>
                                            <td>{company.contact_person || '—'}</td>
                                            <td>{company.contact_email || '—'}</td>
                                            <td>{company.kyb_verified ? 'Yes' : 'No'}</td>
                                            <td>{company.user_count}</td>
                                            <td>{company.max_booking_per_day ?? '—'}</td>
                                            <td className="text-end">
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={() =>
                                                  toggleCompanyExpanded(row.id, company.id)
                                                }
                                                aria-expanded={isCompanyExpanded}
                                                aria-label={
                                                  isCompanyExpanded
                                                    ? `Collapse users for ${company.name}`
                                                    : `Expand users for ${company.name}`
                                                }
                                              >
                                                <i
                                                  className={`bi ${
                                                    isCompanyExpanded
                                                      ? 'bi-caret-up-fill'
                                                      : 'bi-caret-down-fill'
                                                  }`}
                                                  aria-hidden="true"
                                                />
                                              </button>
                                            </td>
                                          </tr>
                                          {isCompanyExpanded && (
                                            <tr>
                                              <td colSpan={8} className="bg-white border-top">
                                                <div className="px-2 py-3">
                                                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                                                    <div className="fw-semibold small">
                                                      Users in {company.name}
                                                    </div>
                                                    {usersLoaded && !usersLoading && (
                                                      <div className="emails-search admin-accounts-user-search">
                                                        <i
                                                          className="bi bi-search"
                                                          aria-hidden="true"
                                                        />
                                                        <input
                                                          type="search"
                                                          className="emails-search-input"
                                                          placeholder="Search users…"
                                                          value={userSearch}
                                                          onChange={(e) =>
                                                            handleCompanyUserSearch(
                                                              key,
                                                              e.target.value,
                                                            )
                                                          }
                                                          aria-label={`Search users in ${company.name}`}
                                                        />
                                                        {userSearch && (
                                                          <button
                                                            type="button"
                                                            className="emails-search-clear"
                                                            onClick={() =>
                                                              handleCompanyUserSearch(key, '')
                                                            }
                                                            aria-label="Clear user search"
                                                          >
                                                            <i className="bi bi-x-lg" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                  {usersLoading ? (
                                                    <div className="small text-muted">
                                                      Loading users…
                                                    </div>
                                                  ) : companyUsersError[key] ? (
                                                    <div className="small text-danger">
                                                      {companyUsersError[key]}
                                                    </div>
                                                  ) : !usersLoaded ? (
                                                    <div className="small text-muted">
                                                      Loading users…
                                                    </div>
                                                  ) : allCompanyUsers.length === 0 ? (
                                                    <div className="small text-muted">
                                                      No users found.
                                                    </div>
                                                  ) : filteredCompanyUsers.length === 0 ? (
                                                    <div className="small text-muted">
                                                      No users match your search.
                                                    </div>
                                                  ) : (
                                                    <div className="table-responsive">
                                                      <table className="table table-sm mb-0 align-middle">
                                                        <thead>
                                                          <tr>
                                                            <th>Name</th>
                                                            <th>Email</th>
                                                            <th>Active</th>
                                                            <th />
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {visibleCompanyUsers.map((user) => (
                                                            <tr key={user.id}>
                                                              <td>{userDisplayName(user)}</td>
                                                              <td>{user.email}</td>
                                                              <td>
                                                                <span
                                                                  className={`badge ${
                                                                    user.is_active
                                                                      ? 'text-bg-success'
                                                                      : 'text-bg-secondary'
                                                                  }`}
                                                                >
                                                                  {user.is_active
                                                                    ? 'Active'
                                                                    : 'Inactive'}
                                                                </span>
                                                              </td>
                                                              <td className="text-end">
                                                                <button
                                                                  type="button"
                                                                  className="btn btn-sm btn-outline-primary"
                                                                  disabled={
                                                                    !user.can_impersonate ||
                                                                    impersonatingUserId != null
                                                                  }
                                                                  onClick={() =>
                                                                    void handleViewAsUser(user)
                                                                  }
                                                                >
                                                                  {impersonatingUserId === user.id
                                                                    ? 'Starting…'
                                                                    : 'View as user'}
                                                                </button>
                                                              </td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                      {hasMoreCompanyUsers && (
                                                        <div className="text-center py-2 border-top">
                                                          <button
                                                            type="button"
                                                            className="btn btn-sm btn-link"
                                                            onClick={() => showMoreUsers(key)}
                                                          >
                                                            Show more (
                                                            {filteredCompanyUsers.length -
                                                              visibleUserCount}{' '}
                                                            remaining)
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      )
                                    })}
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
