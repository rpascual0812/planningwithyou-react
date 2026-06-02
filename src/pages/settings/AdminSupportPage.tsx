import { useCallback, useEffect, useRef, useState } from 'react'
import SupportTicketChatModal from '../../components/SupportTicketChatModal'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import {
  fetchAdminSupportTicket,
  fetchAdminSupportTicketsPage,
  sendAdminSupportTicketMessage,
  updateAdminSupportTicketStatus,
  type SupportTicketsPage,
} from '../../services/adminSupportTickets'
import {
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from '../../services/supportTickets'

const STATUS_OPTIONS: { value: '' | SupportTicketStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

function formatDateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString()
}

const AdminSupportPage = () => {
  const { canWrite: supportWrite } = useFeatureAccess('admin_support')
  const [rows, setRows] = useState<SupportTicketRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatTicket, setChatTicket] = useState<SupportTicketRecord | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | SupportTicketStatus>('')
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

  const loadPage = useCallback(async (
    pageNum: number,
    replace: boolean,
    q = '',
    status = '',
  ) => {
    if (replace) {
      setLoading(true)
      setError(null)
    } else {
      if (loadingMoreRef.current) return
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    try {
      const data: SupportTicketsPage = await fetchAdminSupportTicketsPage(pageNum, q, status)
      setRows((prev) => (replace ? data.results : [...prev, ...data.results]))
      setTotalCount(data.count)
      setPage(pageNum)
      setHasMore(data.next != null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load support tickets'
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
  }, [])

  useEffect(() => {
    void loadPage(1, true, debouncedSearch, statusFilter)
  }, [debouncedSearch, statusFilter, loadPage])

  const loadNextPage = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    void loadPage(page + 1, false, debouncedSearch, statusFilter)
  }, [hasMore, loading, loadingMore, page, debouncedSearch, statusFilter, loadPage])

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

  const handleTicketUpdated = useCallback(
    (summary: { id: number; status: SupportTicketStatus; is_read: boolean }) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === summary.id
            ? { ...r, status: summary.status, is_read: summary.is_read }
            : r,
        ),
      )
      setChatTicket((prev) =>
        prev && prev.id === summary.id
          ? { ...prev, status: summary.status, is_read: summary.is_read }
          : prev,
      )
    },
    [],
  )

  return (
    <>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <input
          type="search"
          className="form-control"
          placeholder="Search title, user, or message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '280px' }}
        />
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as '' | SupportTicketStatus)
          }
          style={{ maxWidth: '180px' }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-danger small" role="alert">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-muted small mb-0">Loading support tickets…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted small mb-0">No support tickets match your filters.</p>
      ) : (
        <div
          ref={scrollRootRef}
          className="table-responsive"
          onScroll={handleRowsScroll}
        >
          <table className="table table-sm align-middle mb-0 support-tickets-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>From</th>
                <th>Status</th>
                <th>Last activity</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`support-tickets-row${row.is_read ? '' : ' support-tickets-row--unread'}`}
                >
                  <td>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-start support-tickets-title-btn"
                      onClick={() => setChatTicket(row)}
                    >
                      {row.title}
                    </button>
                    {row.last_message_preview ? (
                      <div className="text-muted small text-truncate support-tickets-preview">
                        {row.last_message_preview}
                      </div>
                    ) : null}
                  </td>
                  <td className="small">{row.created_by_name || '—'}</td>
                  <td>
                    {SUPPORT_TICKET_STATUS_LABELS[row.status] ?? row.status}
                  </td>
                  <td className="text-muted small">
                    {formatDateTime(row.last_message_at || row.created_at)}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setChatTicket(row)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {hasMore && rows.length > 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted small py-3">
                    {loadingMore ? 'Loading more...' : 'Scroll for more'}
                  </td>
                </tr>
              )}
              {!hasMore && rows.length > 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center text-muted small py-3">
                    All {totalCount} support ticket{totalCount !== 1 ? 's have' : ' has'} been loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {chatTicket && (
        <SupportTicketChatModal
          ticketId={chatTicket.id}
          title={chatTicket.title}
          status={chatTicket.status}
          createdByName={chatTicket.created_by_name}
          canReply={supportWrite}
          isAdmin
          loadTicket={fetchAdminSupportTicket}
          sendMessage={sendAdminSupportTicketMessage}
          updateStatus={
            supportWrite ? updateAdminSupportTicketStatus : undefined
          }
          onClose={() => {
            setChatTicket(null)
            void loadPage(1, true, debouncedSearch, statusFilter)
          }}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </>
  )
}

export default AdminSupportPage
