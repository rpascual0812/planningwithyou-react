import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SearchableSelect from '../../components/SearchableSelect'
import { useSearchParams } from 'react-router-dom'
import EmailSenderModal from '../../components/EmailSenderModal'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import {
  fetchAdminEmails,
  resendEmail,
  type EmailRecord,
  type EmailPayload,
} from '../../services/emails'
import {
  fetchCompaniesDirectory,
  type CompanyRecord,
} from '../../services/companies'

const EDIT_PARAM = 'edit'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
]

const statusBadge = (status: EmailRecord['status']) => {
  const cls =
    status === 'sent'
      ? 'emails-status--sent'
      : status === 'failed'
        ? 'emails-status--failed'
        : 'emails-status--queued'
  return <span className={`emails-status ${cls}`}>{status}</span>
}

const formatRecipients = (addrs: string[]) => {
  if (!addrs.length) return '—'
  if (addrs.length <= 2) return addrs.join(', ')
  return `${addrs[0]}, ${addrs[1]} (+${addrs.length - 2})`
}

const AdminEmailPage = () => {
  const { canWrite: emailsWrite } = useFeatureAccess('admin_emails')
  const [searchParams, setSearchParams] = useSearchParams()
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [companyFilterId, setCompanyFilterId] = useState<number | null>(null)

  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [selected, setSelected] = useState<EmailRecord | null>(null)
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const companyOptions = useMemo(
    () => [
      { value: '', label: 'All companies' },
      ...companies.map((company) => ({
        value: String(company.id),
        label: company.name,
      })),
    ],
    [companies],
  )

  const writeEditParam = (id: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set(EDIT_PARAM, String(id))
      return next
    }, { replace: true })
  }

  const clearEditParam = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(EDIT_PARAM)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  useEffect(() => {
    let cancelled = false
    setCompaniesLoading(true)
    void fetchCompaniesDirectory()
      .then((companyRows) => {
        if (cancelled) return
        setCompanies(companyRows)
        setCompanyFilterId(null)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load companies')
        }
      })
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadEmails = useCallback(
    async (q = '', status = '', companyId: number | null = null) => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchAdminEmails(q, status, companyId)
        setEmails(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load emails')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void loadEmails(debouncedSearch, statusFilter, companyFilterId)
  }, [debouncedSearch, statusFilter, companyFilterId, loadEmails])

  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId) return
    const email = emails.find((e) => String(e.id) === targetId)
    if (!email) {
      if (!loading) clearEditParam()
      return
    }
    if (
      selected &&
      selected.id === email.id &&
      selected.status === email.status &&
      selected.subject === email.subject &&
      selected.attempts === email.attempts &&
      selected.error === email.error &&
      selected.sent_at === email.sent_at
    ) {
      return
    }
    setSelected(email)
    setResendError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, emails, loading])

  const openEmail = (email: EmailRecord) => {
    writeEditParam(email.id)
  }

  const closeModal = () => {
    clearEditParam()
    setSelected(null)
    setResendError(null)
  }

  const handleSend = async (data: EmailPayload) => {
    if (!selected) return
    setResending(true)
    setResendError(null)
    try {
      await resendEmail(selected.id, data)
      closeModal()
      await loadEmails(debouncedSearch, statusFilter, companyFilterId)
    } catch (e) {
      setResendError(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="emails-table-card">
          <div className="row g-2 align-items-end mb-3 px-2 pt-2">
            <div className="col-sm-8 col-md-4">
              <SearchableSelect
                label="Company"
                labelClassName="form-label mb-1"
                wrapperClassName=""
                size="sm"
                value={companyFilterId != null ? String(companyFilterId) : ''}
                onChange={(raw) => {
                  setCompanyFilterId(raw === '' ? null : Number(raw))
                }}
                options={companyOptions}
                placeholder="All companies"
                searchPlaceholder="Search companies…"
                emptyMessage="No companies match your search"
                disabled={companiesLoading}
                loading={companiesLoading}
              />
            </div>
          </div>
          <div className="emails-table-toolbar">
            <div className="emails-search">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                className="emails-search-input"
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search emails"
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
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="emails-search-count">
                {emails.length} email{emails.length !== 1 && 's'}
              </span>
            </div>
          </div>

          <div className="emails-table-scroll">
            {loading && emails.length === 0 ? (
              <div className="emails-table-empty-wrap">
                <span className="emails-table-empty">Loading emails...</span>
              </div>
            ) : error ? (
              <div className="emails-table-empty-wrap">
                <span className="emails-table-empty emails-table-error">
                  {error}
                </span>
              </div>
            ) : (
              <table className="emails-table">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Sent At</th>
                    <th>Created At</th>
                    <th className="emails-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => (
                    <tr key={email.id} className="emails-table-row">
                      <td className="emails-table-id">{email.id}</td>
                      <td className="emails-from">{email.email_from}</td>
                      <td>
                        <span className="emails-recipient-email">
                          {formatRecipients(email.to)}
                        </span>
                      </td>
                      <td className="emails-subject">{email.subject}</td>
                      <td>{statusBadge(email.status)}</td>
                      <td className="emails-attempts">{email.attempts}</td>
                      <td className="emails-date">
                        {email.sent_at
                          ? new Date(email.sent_at).toLocaleString()
                          : '—'}
                      </td>
                      <td className="emails-date">
                        {new Date(email.created_at).toLocaleString()}
                      </td>
                      <td>
                        <div className="emails-actions">
                          <button
                            type="button"
                            className="emails-action-btn emails-action-view"
                            title="View / Resend"
                            onClick={() => openEmail(email)}
                          >
                            <i className="bi bi-eye" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {emails.length === 0 && !loading && (
                    <tr>
                      <td colSpan={9} className="emails-table-empty">
                        {search || statusFilter || companyFilterId != null
                          ? 'No emails match your filters.'
                          : 'No emails recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <EmailSenderModal
          email={selected}
          error={resendError}
          sending={resending}
          canWrite={emailsWrite}
          onSend={handleSend}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

export default AdminEmailPage
