import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import AdminKybReviewModal from './AdminKybReviewModal'
import {
  fetchAdminKybVerifications,
  type AdminKybStatusFilter,
  type CompanyKybListRecord,
} from '../../services/adminCompanyKyb'

const STATUS_OPTIONS: { value: AdminKybStatusFilter; label: string }[] = [
  { value: 'pending_paymongo', label: 'Pending PayMongo' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
  { value: 'draft', label: 'Draft' },
]

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  sole_proprietor: 'Sole proprietorship',
  partnership: 'Partnership',
  corporation: 'Corporation',
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'text-bg-secondary',
  pending_paymongo: 'text-bg-warning',
  approved: 'text-bg-success',
  rejected: 'text-bg-danger',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_paymongo: 'Pending PayMongo',
  approved: 'Approved',
  rejected: 'Rejected',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const AdminKYBPage = () => {
  const { canWrite: kybWrite } = useFeatureAccess('admin_company_verification')
  const [rows, setRows] = useState<CompanyKybListRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<AdminKybStatusFilter>('pending_paymongo')
  const [selected, setSelected] = useState<CompanyKybListRecord | null>(null)

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
      const data = await fetchAdminKybVerifications(statusFilter, debouncedSearch)
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verifications')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedSearch])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  return (
    <>
      <p className="text-muted small mb-3">
        Merchants complete document verification on PayMongo. Use this list to
        monitor status and manually approve only when PayMongo verification needs
        an override.
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
              {rows.length} verification{rows.length !== 1 && 's'}
            </span>
          </div>
        </div>

        <div className="emails-table-scroll">
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
                  <th>Status</th>
                  <th>Started</th>
                  <th>Reviewed</th>
                  <th className="emails-th-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="emails-table-empty">
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
                      <td>
                        <span
                          className={`badge ${
                            STATUS_BADGE[row.status] ?? 'text-bg-secondary'
                          }`}
                        >
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                      </td>
                      <td>{formatDateTime(row.submitted_at)}</td>
                      <td>{formatDateTime(row.reviewed_at)}</td>
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
          onApproved={() => void loadRows()}
        />
      )}
    </>
  )
}

export default AdminKYBPage
