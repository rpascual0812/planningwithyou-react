import { useCallback, useEffect, useState } from 'react'

import EmailSenderModal from './EmailSenderModal'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import {
  emailLogDisplayTimeZone,
  formatAppDateTime,
} from '../lib/formatDateTime'
import { resendEmail, type EmailPayload, type EmailRecord } from '../services/emails'
import { fetchQuotationEmailLogs } from '../services/quotationEmails'
import { showErrorToast, showSuccessToast } from '../utils/toast'

type Props = {
  quotationId: number
  quotationLabel?: string
  refreshKey?: number
}

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

const QuotationEmailLogsPanel = ({
  quotationId,
  quotationLabel,
  refreshKey = 0,
}: Props) => {
  const { canWrite: emailsWrite } = useFeatureAccess('emails')
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<EmailRecord | null>(null)
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchQuotationEmailLogs(quotationId)
      setEmails(rows)
    } catch (e) {
      showErrorToast(
        e instanceof Error ? e.message : 'Failed to load email logs',
      )
      setEmails([])
    } finally {
      setLoading(false)
    }
  }, [quotationId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const handleResend = async (data: EmailPayload) => {
    if (!selected || !emailsWrite) return
    setResending(true)
    setResendError(null)
    try {
      await resendEmail(selected.id, data)
      showSuccessToast('Email queued for delivery.')
      setSelected(null)
      await load()
    } catch (e) {
      setResendError(e instanceof Error ? e.message : 'Resend failed')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="quotation-email-logs-panel">
      <div className="quotation-email-logs-panel__head">
        <h5 className="quotation-email-logs-panel__title mb-0">Email logs</h5>
        <span className="text-muted small">
          {loading
            ? 'Loading…'
            : `${emails.length} email${emails.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {loading ? (
        <div className="text-muted small py-4 text-center">Loading email logs…</div>
      ) : emails.length === 0 ? (
        <div className="text-muted small py-4 text-center">
          No emails have been sent for this quotation yet.
        </div>
      ) : (
        <div className="quotation-email-logs-panel__table-wrap">
          <table className="emails-table quotation-email-logs-panel__table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>To</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr
                  key={email.id}
                  className="quotation-email-logs-panel__row"
                  tabIndex={0}
                  role="button"
                  onClick={() => {
                    setResendError(null)
                    setSelected(email)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setResendError(null)
                      setSelected(email)
                    }
                  }}
                >
                  <td className="quotation-email-logs-panel__subject">
                    {email.subject?.trim() || '(No subject)'}
                  </td>
                  <td>{formatRecipients(email.to ?? [])}</td>
                  <td>{statusBadge(email.status)}</td>
                  <td>
                    {email.sent_at
                      ? formatAppDateTime(
                          email.sent_at,
                          emailLogDisplayTimeZone(email, []),
                        )
                      : '—'}
                  </td>
                  <td>
                    {formatAppDateTime(
                      email.created_at,
                      emailLogDisplayTimeZone(email, []),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <EmailSenderModal
          email={selected}
          stacked
          error={resendError}
          sending={resending}
          canWrite={emailsWrite}
          quotationId={quotationLabel ?? quotationId}
          onSend={(data) => void handleResend(data)}
          onClose={() => {
            setSelected(null)
            setResendError(null)
          }}
        />
      )}
    </div>
  )
}

export default QuotationEmailLogsPanel
