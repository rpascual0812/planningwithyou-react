import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchAdminAccounts,
  type AdminAccountRecord,
} from '../../services/adminAccounts'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const AdminAccountsPage = () => {
  const [rows, setRows] = useState<AdminAccountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

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
      const data = await fetchAdminAccounts(debouncedSearch)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

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
              {rows.length} account{rows.length !== 1 && 's'}
            </span>
          </div>
        </div>

        <div className="emails-table-scroll">
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
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="emails-table-empty">
                      No accounts match your search.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="emails-table-row">
                      <td className="emails-table-id">{row.id}</td>
                      <td>{row.name}</td>
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
                      <td>{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))
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
