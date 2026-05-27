import { useCallback, useEffect, useState } from 'react'
import {
  approveAdminKybVerification,
  fetchAdminKybVerification,
} from '../../services/adminCompanyKyb'
import type { CompanyKybRecord } from '../../services/companyKyb'
import { showErrorToast, showSuccessToast } from '../../utils/toast'

type Props = {
  verificationId: number
  companyName: string
  canApprove?: boolean
  onClose: () => void
  onApproved: () => void
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_paymongo: 'Pending PayMongo verification',
  approved: 'Approved',
  rejected: 'Rejected',
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  sole_proprietor: 'Sole proprietorship',
  corporation: 'Corporation',
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function KybReadOnlyText({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  const trimmed = (value ?? '').trim()
  return (
    <div className="mb-3">
      <div className="text-muted small mb-1">{label}</div>
      {trimmed ? (
        multiline ? (
          <pre className="admin-kyb-readonly-text mb-0">{trimmed}</pre>
        ) : (
          <div className="small">{trimmed}</div>
        )
      ) : (
        <div className="small text-muted">—</div>
      )}
    </div>
  )
}

const AdminKybReviewModal = ({
  verificationId,
  companyName,
  canApprove = false,
  onClose,
  onApproved,
}: Props) => {
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [record, setRecord] = useState<CompanyKybRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminKybVerification(verificationId)
      setRecord(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verification')
    } finally {
      setLoading(false)
    }
  }, [verificationId])

  useEffect(() => {
    void load()
  }, [load])

  const handleApprove = async () => {
    setApproving(true)
    setError(null)
    try {
      await approveAdminKybVerification(verificationId)
      showSuccessToast('Verification marked approved.')
      onApproved()
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Approval failed'
      setError(message)
      showErrorToast(message)
    } finally {
      setApproving(false)
    }
  }

  const bank = record?.bank_details ?? {}
  const rejectionNote = record?.rejection_reason ?? record?.rejection_notes

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5">
                Business verification — {companyName}
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {loading ? (
                <p className="text-muted mb-0">Loading…</p>
              ) : error && !record ? (
                <p className="text-danger mb-0">{error}</p>
              ) : record ? (
                <>
                  <p className="text-muted small">
                    Documents are submitted on PayMongo. This view shows the
                    application data stored in Planning With You.
                  </p>

                  <div className="row g-3 mb-3">
                    <div className="col-sm-6">
                      <KybReadOnlyText label="Company ID" value={String(record.company)} />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Status"
                        value={STATUS_LABELS[record.status] ?? record.status}
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Business type"
                        value={
                          BUSINESS_TYPE_LABELS[record.business_type] ??
                          record.business_type
                        }
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="PayMongo merchant ID"
                        value={record.paymongo_merchant_id}
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Started at"
                        value={formatDateTime(record.submitted_at)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Reviewed at"
                        value={formatDateTime(record.reviewed_at)}
                      />
                    </div>
                  </div>

                  <fieldset className="mb-3">
                    <legend className="fs-6 fw-semibold">Application</legend>
                    <KybReadOnlyText
                      label="Business name"
                      value={record.merchant_business_name}
                    />
                    <KybReadOnlyText label="Email" value={record.merchant_email} />
                    <KybReadOnlyText
                      label="Mobile"
                      value={record.merchant_mobile_number}
                    />
                    <KybReadOnlyText
                      label="Website"
                      value={record.business_website}
                    />
                  </fieldset>

                  <fieldset className="mb-3">
                    <legend className="fs-6 fw-semibold">Bank details</legend>
                    <KybReadOnlyText label="Bank" value={bank.bank_name ?? ''} />
                    <KybReadOnlyText
                      label="Account name"
                      value={bank.account_name ?? ''}
                    />
                    <KybReadOnlyText
                      label="Account number"
                      value={bank.account_number ?? ''}
                    />
                  </fieldset>

                  {record.onboarding_url?.trim() ? (
                    <div className="mb-3">
                      <div className="text-muted small mb-1">Onboarding URL</div>
                      <a
                        href={record.onboarding_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="small"
                      >
                        Open PayMongo onboarding
                      </a>
                    </div>
                  ) : null}

                  {rejectionNote?.trim() ? (
                    <KybReadOnlyText
                      label="Rejection reason"
                      value={rejectionNote}
                      multiline
                    />
                  ) : null}

                  {error && (
                    <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                      {error}
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={approving}
              >
                Close
              </button>
              {canApprove && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleApprove()}
                  disabled={
                    approving || loading || record?.status === 'approved'
                  }
                >
                  {approving ? 'Approving…' : 'Manual approve'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminKybReviewModal
