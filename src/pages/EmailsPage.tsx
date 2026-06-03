import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import EmailSenderModal from '../components/EmailSenderModal'
import {
  fetchEmailsPage,
  sendEmail,
  resendEmail,
  type EmailsPage,
  type EmailRecord,
  type EmailPayload,
} from '../services/emails'
import CompanyFilterSelect from '../components/CompanyFilterSelect'
import { useCompanyFilter } from '../hooks/useCompanyFilter'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import {
  emailLogDisplayTimeZone,
  formatAppDateTime,
} from '../lib/formatDateTime'

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

const EmailsPage = () => {
  const { canWrite: emailsWrite } = useFeatureAccess('emails')
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
  } = useCompanyFilter({
    onFetchError: setError,
  })

  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [emailsTotal, setEmailsTotal] = useState(0)
  const [emailsPage, setEmailsPage] = useState(0)
  const [emailsHasMore, setEmailsHasMore] = useState(false)
  const [emailsLoadingMore, setEmailsLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [selected, setSelected] = useState<EmailRecord | null>(null)
  const [composing, setComposing] = useState(
    () => searchParams.get(EDIT_PARAM) === 'compose',
  )
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emailsLoadingMoreRef = useRef(false)
  const emailsScrollRef = useRef<HTMLDivElement | null>(null)
  const emailsSentinelRef = useRef<HTMLTableRowElement | null>(null)

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

  const loadEmailsPage = useCallback(
    async (
      pageNum: number,
      replace: boolean,
      q = '',
      status = '',
      companyId: number | null = null,
    ) => {
      if (companyId == null) {
        if (replace) {
          setEmails([])
          setEmailsTotal(0)
          setEmailsPage(0)
          setEmailsHasMore(false)
          setLoading(false)
        }
        return
      }
      if (replace) {
        setLoading(true)
      } else {
        if (emailsLoadingMoreRef.current) return
        emailsLoadingMoreRef.current = true
        setEmailsLoadingMore(true)
      }
      setError(null)
      try {
        const data: EmailsPage = await fetchEmailsPage(
          pageNum,
          q,
          status,
          companyId,
        )
        setEmails((prev) => (replace ? data.results : [...prev, ...data.results]))
        setEmailsTotal(data.count)
        setEmailsPage(pageNum)
        setEmailsHasMore(data.next != null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load emails')
      } finally {
        if (replace) {
          setLoading(false)
        } else {
          emailsLoadingMoreRef.current = false
          setEmailsLoadingMore(false)
        }
      }
    },
    [],
  )

  const loadEmails = useCallback(
    async (q = '', status = '', companyId: number | null = null) => {
      await loadEmailsPage(1, true, q, status, companyId)
    },
    [loadEmailsPage],
  )

  useEffect(() => {
    void loadEmails(debouncedSearch, statusFilter, activeCompanyId)
  }, [debouncedSearch, statusFilter, activeCompanyId, loadEmails])

  const loadNextEmailsPage = useCallback(() => {
    if (!emailsHasMore || loading || emailsLoadingMore) return
    void loadEmailsPage(
      emailsPage + 1,
      false,
      debouncedSearch,
      statusFilter,
      activeCompanyId,
    )
  }, [
    emailsHasMore,
    loading,
    emailsLoadingMore,
    emailsPage,
    debouncedSearch,
    statusFilter,
    activeCompanyId,
    loadEmailsPage,
  ])

  const maybeLoadNextEmailsPage = useCallback(() => {
    if (!emailsHasMore || loading || emailsLoadingMore) return
    const root = emailsScrollRef.current
    const containerHasVerticalScroll =
      !!root && root.scrollHeight > root.clientHeight + 1
    const nearContainerBottom =
      !!root &&
      root.scrollTop + root.clientHeight >= root.scrollHeight - 12
    const page = document.documentElement
    const nearPageBottom =
      window.innerHeight + window.scrollY >= page.scrollHeight - 12
    if (
      (containerHasVerticalScroll && nearContainerBottom) ||
      (!containerHasVerticalScroll && nearPageBottom)
    ) {
      loadNextEmailsPage()
    }
  }, [emailsHasMore, loading, emailsLoadingMore, loadNextEmailsPage])

  const handleEmailsScroll = useCallback(() => {
    maybeLoadNextEmailsPage()
  }, [maybeLoadNextEmailsPage])

  useEffect(() => {
    window.addEventListener('scroll', maybeLoadNextEmailsPage, { passive: true })
    return () => window.removeEventListener('scroll', maybeLoadNextEmailsPage)
  }, [maybeLoadNextEmailsPage])

  // Keep modal in sync with URL param and refreshed data
  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId || targetId === 'compose') return
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

  const openCompose = () => {
    if (!emailsWrite) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set(EDIT_PARAM, 'compose')
      return next
    }, { replace: true })
    setSelected(null)
    setResendError(null)
    setComposing(true)
  }

  const closeModal = () => {
    clearEditParam()
    setSelected(null)
    setComposing(false)
    setResendError(null)
  }

  const handleSend = async (data: EmailPayload) => {
    if (!emailsWrite) return
    setResending(true)
    setResendError(null)
    try {
      if (selected) {
        await resendEmail(selected.id, data)
      } else {
        await sendEmail(data, activeCompanyId)
      }
      closeModal()
      await loadEmails(debouncedSearch, statusFilter, activeCompanyId)
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
            <CompanyFilterSelect
              id="emails-company"
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
                {emailsTotal > 0
                  ? `${emails.length} of ${emailsTotal} emails`
                  : `${emails.length} email${emails.length !== 1 ? 's' : ''}`}
              </span>
              {emailsWrite && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={openCompose}
                  disabled={activeCompanyId == null || companiesLoading}
                >
                  <i className="bi bi-pencil-square me-1" />
                  Compose
                </button>
              )}
            </div>
          </div>

          <div
            ref={emailsScrollRef}
            className="emails-table-scroll"
            onScroll={handleEmailsScroll}
          >
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
                          ? formatAppDateTime(
                              email.sent_at,
                              emailLogDisplayTimeZone(email, companies),
                            )
                          : '—'}
                      </td>
                      <td className="emails-date">
                        {formatAppDateTime(
                          email.created_at,
                          emailLogDisplayTimeZone(email, companies),
                        )}
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
                        {search || statusFilter || activeCompanyId != null
                          ? 'No emails match your filters.'
                          : 'No emails recorded yet.'}
                      </td>
                    </tr>
                  )}
                  {emailsHasMore && emails.length > 0 && (
                    <tr ref={emailsSentinelRef} className="emails-list-sentinel">
                      <td colSpan={9} className="text-center text-muted small py-3">
                        {emailsLoadingMore ? (
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
                  {!emailsHasMore && emails.length > 0 && !loading && (
                    <tr className="emails-list-end">
                      <td colSpan={9} className="emails-table-empty">
                        All {emailsTotal} email{emailsTotal !== 1 ? 's have' : ' has'} been loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {(selected || composing) && (
        <EmailSenderModal
          email={selected}
          error={resendError}
          sending={resending}
          canWrite={emailsWrite}
          onSend={handleSend}
          onClose={closeModal}
          bookingTemplateCompanyId={activeCompanyId}
        />
      )}
    </div>
  )
}

export default EmailsPage
