import { useCallback, useEffect, useState } from 'react'
import {
  approveAdminKybVerification,
  fetchAdminKybVerification,
} from '../../services/adminCompanyKyb'
import KybDocumentDisplay from '../../components/KybDocumentDisplay'
import type { CompanyKybRecord } from '../../services/companyKyb'
import { showErrorToast, showSuccessToast } from '../../utils/toast'

type Props = {
  verificationId: number
  companyName: string
  onClose: () => void
  onApproved: () => void
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted for review',
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
      showSuccessToast('KYB verification approved.')
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

  const ownerFiles = (record?.owner_director_id_files ?? []).map((entry, index) => {
    if (typeof entry === 'string') {
      return { label: `Owner/director ${index + 1}`, file: entry }
    }
    return {
      label: entry.label?.trim() || `Owner/director ${index + 1}`,
      file: entry.file ?? '',
    }
  })

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5">
                KYB verification — {companyName}
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
                        label="Submitted at"
                        value={formatDateTime(record.submitted_at)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Reviewed at"
                        value={formatDateTime(record.reviewed_at)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Reviewed by (user id)"
                        value={
                          record.reviewed_by != null
                            ? String(record.reviewed_by)
                            : ''
                        }
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Created at"
                        value={formatDateTime(record.created_at)}
                      />
                    </div>
                    <div className="col-sm-6">
                      <KybReadOnlyText
                        label="Updated at"
                        value={formatDateTime(record.updated_at)}
                      />
                    </div>
                  </div>

                  {record.business_type === 'sole_proprietor' && (
                    <fieldset className="mb-3">
                      <legend className="fs-6 fw-semibold">Sole proprietorship</legend>
                      <KybDocumentDisplay
                        label="Valid government ID"
                        fileUrl={record.government_id_file}
                      />
                      <KybDocumentDisplay
                        label="DTI registration"
                        fileUrl={record.dti_registration_file}
                      />
                      <KybReadOnlyText
                        label="Business address"
                        value={record.sole_prop_business_address}
                        multiline
                      />
                      <KybReadOnlyText
                        label="Mobile number"
                        value={record.sole_prop_mobile_number}
                      />
                      <KybReadOnlyText
                        label="Bank account under same name"
                        value={record.bank_account_same_name}
                        multiline
                      />
                    </fieldset>
                  )}

                  {record.business_type === 'corporation' && (
                    <fieldset className="mb-3">
                      <legend className="fs-6 fw-semibold">Corporation</legend>
                      <KybDocumentDisplay
                        label="SEC registration"
                        fileUrl={record.sec_registration_file}
                      />
                      <KybDocumentDisplay
                        label="Articles of Incorporation"
                        fileUrl={record.articles_of_incorporation_file}
                      />
                      <KybDocumentDisplay
                        label="BIR registration"
                        fileUrl={record.bir_registration_file}
                      />
                      {ownerFiles.map((row, index) => (
                        <KybDocumentDisplay
                          key={index}
                          label={row.label}
                          fileUrl={row.file}
                        />
                      ))}
                      <KybReadOnlyText
                        label="Business website / social pages"
                        value={record.business_website_social}
                        multiline
                      />
                      <KybReadOnlyText
                        label="Company email domain"
                        value={record.company_email_domain}
                      />
                    </fieldset>
                  )}

                  {record.business_type && (
                    <fieldset className="mb-0">
                      <legend className="fs-6 fw-semibold">Additional checks</legend>
                      <KybDocumentDisplay
                        label="Proof of address"
                        fileUrl={record.proof_of_address_file}
                      />
                      <KybReadOnlyText
                        label="Business description"
                        value={record.business_description}
                        multiline
                      />
                    </fieldset>
                  )}

                  {record.rejection_notes?.trim() ? (
                    <KybReadOnlyText
                      label="Rejection notes"
                      value={record.rejection_notes}
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleApprove()}
                disabled={
                  approving || loading || record?.status === 'approved'
                }
              >
                {approving ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminKybReviewModal
