import { useCallback, useEffect, useState } from 'react'
import SupportTicketChatModal from '../../components/SupportTicketChatModal'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import {
  fetchAdminSupportTicket,
  fetchAdminSupportTickets,
  sendAdminSupportTicketMessage,
  updateAdminSupportTicketStatus,
} from '../../services/adminSupportTickets'
import {
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from '../../services/supportTickets'

function formatDateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString()
}

const AdminSupportPage = () => {
  const { canWrite: supportWrite } = useFeatureAccess('admin_support')
  const [rows, setRows] = useState<SupportTicketRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatTicket, setChatTicket] = useState<SupportTicketRecord | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminSupportTickets()
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load support tickets')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

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
      {error && (
        <p className="text-danger small" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted small mb-0">Loading support tickets…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted small mb-0">No support tickets filed yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 support-tickets-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>From</th>
                <th>Status</th>
                <th>Filed</th>
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
                    {formatDateTime(row.created_at)}
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
            void loadRows()
          }}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </>
  )
}

export default AdminSupportPage
