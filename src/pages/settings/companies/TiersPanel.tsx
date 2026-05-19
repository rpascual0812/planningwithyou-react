import { useCallback, useEffect, useState } from 'react'
import { fetchActiveCompanies, type CompanyRecord } from '../../../services/companies'
import {
  createTier,
  deleteTier,
  fetchAllTiers,
  updateTier,
  type TierPayload,
  type TierRecord,
} from '../../../services/tiers'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

function pickDefaultCompanyId(companies: CompanyRecord[]): number | null {
  if (companies.length === 0) return null
  const main = companies.find((c) => c.is_main)
  return main?.id ?? companies[0].id
}

const TiersPanel = () => {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  const [tiers, setTiers] = useState<TierRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TierRecord | null>(null)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<TierRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setCompaniesLoading(true)
    setError(null)
    void fetchActiveCompanies()
      .then((data) => {
        if (cancelled) return
        setCompanies(data)
        setSelectedCompanyId((prev) => {
          if (prev != null && data.some((c) => c.id === prev)) return prev
          return pickDefaultCompanyId(data)
        })
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

  const loadTiers = useCallback(async (companyId: number) => {
    setLoading(true)
    setError(null)
    try {
      setTiers(await fetchAllTiers(companyId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tiers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompanyId == null) {
      setTiers([])
      return
    }
    void loadTiers(selectedCompanyId)
  }, [selectedCompanyId, loadTiers])

  const openAdd = () => {
    setEditing(null)
    setName('')
    setIsActive(true)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (tier: TierRecord) => {
    setEditing(tier)
    setName(tier.name)
    setIsActive(tier.is_active)
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
    if (!editing && selectedCompanyId == null) {
      setFormError('Select a company first.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload: TierPayload = { name: trimmed, is_active: isActive }
    try {
      if (editing) {
        await updateTier(editing.id, payload)
        showSuccessToast('Tier updated.')
      } else {
        await createTier({ ...payload, company: selectedCompanyId! })
        showSuccessToast('Tier created.')
      }
      closeModal()
      if (selectedCompanyId != null) await loadTiers(selectedCompanyId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || selectedCompanyId == null) return
    setDeleting(true)
    try {
      await deleteTier(deleteTarget.id)
      showSuccessToast('Tier deleted.')
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) closeModal()
      await loadTiers(selectedCompanyId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed'
      setError(message)
      showErrorToast(message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId)
  const canManageTiers = selectedCompanyId != null && !companiesLoading

  return (
    <div>
      <div className="row g-2 align-items-end mb-3">
        <div className="col-sm-8 col-md-6">
          <label className="form-label mb-1" htmlFor="tiers-company">
            Company
          </label>
          <select
            id="tiers-company"
            className="form-select form-select-sm"
            value={selectedCompanyId ?? ''}
            disabled={companiesLoading || companies.length === 0}
            onChange={(e) => {
              const id = Number(e.target.value)
              setSelectedCompanyId(Number.isFinite(id) && id > 0 ? id : null)
            }}
          >
            {companies.length === 0 ? (
              <option value="">No active companies</option>
            ) : (
              companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.is_main ? ' (main)' : ''}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="col-sm-4 col-md-6 d-flex justify-content-sm-end">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={openAdd}
            disabled={!canManageTiers}
          >
            <i className="bi bi-plus-lg me-1" />
            Add tier
          </button>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {selectedCompany
            ? `${tiers.length} tier${tiers.length !== 1 ? 's' : ''} for ${selectedCompany.name}`
            : 'Select a company to view tiers'}
        </span>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {companiesLoading || (loading && tiers.length === 0) ? (
        <div className="text-muted">Loading…</div>
      ) : selectedCompanyId == null ? (
        <div className="text-muted small">Add an active company before managing tiers.</div>
      ) : tiers.length === 0 ? (
        <div className="text-muted small">
          No tiers yet for this company. Click &quot;Add tier&quot; to create one.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0 bookings-tiers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="bookings-tiers-table__active">Active</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id}>
                  <td className="fw-semibold">{tier.name}</td>
                  <td className="bookings-tiers-table__active">
                    {tier.is_active ? (
                      <span className="badge text-bg-success">Yes</span>
                    ) : (
                      <span className="badge text-bg-secondary">No</span>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="d-inline-flex gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        title="Edit tier"
                        onClick={() => openEdit(tier)}
                      >
                        <i className="bi bi-pencil-square" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        title="Delete tier"
                        onClick={() => setDeleteTarget(tier)}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </td>
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
                    {editing ? 'Edit tier' : 'Add tier'}
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeModal}
                  />
                </div>
                <div className="modal-body">
                  {!editing && selectedCompany && (
                    <p className="text-muted small">
                      Company: <strong>{selectedCompany.name}</strong>
                    </p>
                  )}
                  <div className="mb-3">
                    <label className="form-label" htmlFor="tier-name">
                      Name
                    </label>
                    <input
                      id="tier-name"
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="tier-is-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="tier-is-active">
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
                  <h2 className="modal-title fs-5">Delete tier</h2>
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
                    for this tier will be removed.
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

export default TiersPanel
