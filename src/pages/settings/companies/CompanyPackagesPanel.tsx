import { useCallback, useEffect, useState } from 'react'
import { useAuthSession } from '../../../context/AuthSessionContext'
import CompanyFilterSelect from '../../../components/CompanyFilterSelect'
import { useCompanyFilter } from '../../../hooks/useCompanyFilter'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import { companyNameForScope } from '../../../lib/companySelection'
import {
  createCompanyPackage,
  deleteCompanyPackage,
  fetchAllCompanyPackages,
  updateCompanyPackage,
  type CompanyPackagePayload,
  type CompanyPackageRecord,
} from '../../../services/companyPackages'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

const CompanyPackagesPanel = () => {
  const { currentUser } = useAuthSession()
  const { canWrite: companiesWrite } = useFeatureAccess('companies_settings')
  const [error, setError] = useState<string | null>(null)
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
  } = useCompanyFilter({ onFetchError: setError })

  const [packages, setPackages] = useState<CompanyPackageRecord[]>([])
  const [loading, setLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CompanyPackageRecord | null>(null)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CompanyPackageRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadPackages = useCallback(async (companyId: number) => {
    setLoading(true)
    setError(null)
    try {
      setPackages(await fetchAllCompanyPackages(companyId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeCompanyId == null) {
      setPackages([])
      return
    }
    void loadPackages(activeCompanyId)
  }, [activeCompanyId, loadPackages])

  const openAdd = () => {
    setEditing(null)
    setName('')
    setIsActive(true)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (pkg: CompanyPackageRecord) => {
    setEditing(pkg)
    setName(pkg.name)
    setIsActive(pkg.is_active)
    setFormError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setFormError(null)
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFormError('Name is required.')
      return
    }
    if (!editing && activeCompanyId == null) {
      setFormError('Select a company first.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload: CompanyPackagePayload = { name: trimmed, is_active: isActive }
    try {
      if (editing) {
        await updateCompanyPackage(editing.id, payload)
        showSuccessToast('Package updated.')
      } else {
        await createCompanyPackage({ ...payload, company: activeCompanyId! })
        showSuccessToast('Package created.')
      }
      closeModal()
      if (activeCompanyId != null) await loadPackages(activeCompanyId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || activeCompanyId == null) return
    setDeleting(true)
    try {
      await deleteCompanyPackage(deleteTarget.id)
      showSuccessToast('Package deleted.')
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) closeModal()
      await loadPackages(activeCompanyId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed'
      setError(message)
      showErrorToast(message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const selectedCompanyName = companyNameForScope(
    companies,
    activeCompanyId,
    currentUser,
  )
  const canManagePackages =
    companiesWrite && activeCompanyId != null && !companiesLoading

  return (
    <div>
      <div className="row g-2 align-items-end mb-3">
        <CompanyFilterSelect
          id="packages-company"
          className="col-sm-8 col-md-6"
          companies={companies}
          loading={companiesLoading}
          value={selectedCompanyId}
          onChange={setSelectedCompanyId}
        />
        {companiesWrite && (
          <div className="col-sm-4 col-md-6 d-flex justify-content-sm-end">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={openAdd}
              disabled={!canManagePackages}
            >
              <i className="bi bi-plus-lg me-1" />
              Add package
            </button>
          </div>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {selectedCompanyName
            ? `${packages.length} package${packages.length !== 1 ? 's' : ''} for ${selectedCompanyName}`
            : 'Select a company to view packages'}
        </span>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {companiesLoading || (loading && packages.length === 0) ? (
        <div className="text-muted">Loading…</div>
      ) : activeCompanyId == null ? (
        <div className="text-muted small">Add an active company before managing packages.</div>
      ) : packages.length === 0 ? (
        <div className="text-muted small">
          {companiesWrite
            ? 'No packages yet for this company. Click "Add package" to create one.'
            : 'No packages yet for this company.'}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0 bookings-packages-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="bookings-packages-table__active">Active</th>
                {companiesWrite && <th className="text-end">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="fw-semibold">{pkg.name}</td>
                  <td className="bookings-packages-table__active">
                    {pkg.is_active ? (
                      <span className="badge text-bg-success">Yes</span>
                    ) : (
                      <span className="badge text-bg-secondary">No</span>
                    )}
                  </td>
                  {companiesWrite && (
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          title="Edit package"
                          onClick={() => openEdit(pkg)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Delete package"
                          onClick={() => setDeleteTarget(pkg)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={closeModal}
          />
          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">
                    {editing ? 'Edit package' : 'Add package'}
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeModal}
                  />
                </div>
                <div className="modal-body">
                  {!editing && selectedCompanyName && (
                    <p className="text-muted small">
                      Company: <strong>{selectedCompanyName}</strong>
                    </p>
                  )}
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-name">
                      Name
                    </label>
                    <input
                      id="package-name"
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="package-is-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="package-is-active">
                      Active
                    </label>
                  </div>
                  {formError && (
                    <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                      {formError}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <>
          <div
            className="modal-backdrop fade show"
            onClick={() => setDeleteTarget(null)}
          />
          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">Delete package</h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setDeleteTarget(null)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete <strong>{deleteTarget.name}</strong>? Supplier pricing
                    for this package will be removed.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void confirmDelete()}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CompanyPackagesPanel
