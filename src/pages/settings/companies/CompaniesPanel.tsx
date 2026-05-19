import { useCallback, useEffect, useState } from 'react'
import { fetchSecuredFileBlobUrl } from '../../../lib/securedFileUrl'
import {
  createCompany,
  deleteCompany,
  fetchCompanies,
  updateCompany,
  type CompanyPayload,
  type CompanyRecord,
} from '../../../services/companies'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

const TIMEZONES = [...Intl.supportedValuesOf('timeZone')].sort()

const EMPTY_FORM = {
  name: '',
  timezone: '',
  website: '',
  is_active: true,
  is_main: false,
}

function formatWebsite(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return '—'
  try {
    const parsed = new URL(trimmed)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed
  }
}

const CompaniesPanel = () => {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CompanyRecord | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CompanyRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoDisplayUrl, setLogoDisplayUrl] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCompanies(await fetchCompanies())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  useEffect(() => {
    if (!showModal) return
    if (logoPreview) {
      setLogoDisplayUrl(logoPreview)
      return
    }
    if (!logoUrl) {
      setLogoDisplayUrl('')
      return
    }
    let objectUrl = ''
    let cancelled = false
    fetchSecuredFileBlobUrl(logoUrl)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setLogoDisplayUrl(url)
      })
      .catch(() => {
        if (!cancelled) setLogoDisplayUrl('')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [logoUrl, logoPreview, showModal])

  const resetLogoState = () => {
    setLogoUrl('')
    setLogoFile(null)
    setLogoPreview(null)
    setLogoDisplayUrl('')
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      ...EMPTY_FORM,
      is_main: companies.length === 0,
    })
    resetLogoState()
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (row: CompanyRecord) => {
    setEditing(row)
    setForm({
      name: row.name,
      timezone: row.timezone ?? '',
      website: row.website ?? '',
      is_active: row.is_active,
      is_main: row.is_main,
    })
    setLogoUrl(row.logo_url ?? '')
    setLogoFile(null)
    setLogoPreview(null)
    setFormError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    resetLogoState()
    setFormError(null)
  }

  const handleSave = async () => {
    const trimmed = form.name.trim()
    if (!trimmed) {
      setFormError('Name is required.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload: CompanyPayload = {
      name: trimmed,
      timezone: form.timezone.trim(),
      website: form.website.trim(),
      is_active: form.is_active,
      is_main: form.is_main,
      ...(logoFile ? { logo: logoFile } : {}),
    }
    try {
      if (editing) {
        await updateCompany(editing.id, payload)
        showSuccessToast('Company updated.')
      } else {
        await createCompany(payload)
        showSuccessToast('Company created.')
      }
      closeModal()
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCompany(deleteTarget.id)
      showSuccessToast('Company deleted.')
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) closeModal()
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed'
      setError(message)
      showErrorToast(message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {companies.length} compan{companies.length === 1 ? 'y' : 'ies'}
        </span>
        <button type="button" className="btn btn-sm btn-primary" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1" />
          Add company
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {loading && companies.length === 0 ? (
        <div className="text-muted">Loading…</div>
      ) : companies.length === 0 ? (
        <div className="text-muted small">
          No companies yet. Click &quot;Add company&quot; to create one.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0 bookings-tiers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Website</th>
                <th className="bookings-tiers-table__active">Main</th>
                <th className="bookings-tiers-table__active">Active</th>
                <th className="text-end">Order</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((row) => (
                <tr key={row.id}>
                  <td className="fw-semibold">{row.name}</td>
                  <td className="text-muted small">
                    {row.website ? (
                      <a
                        href={row.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {formatWebsite(row.website)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="bookings-tiers-table__active">
                    {row.is_main ? (
                      <span className="badge text-bg-primary">Main</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="bookings-tiers-table__active">
                    {row.is_active ? (
                      <span className="badge text-bg-success">Yes</span>
                    ) : (
                      <span className="badge text-bg-secondary">No</span>
                    )}
                  </td>
                  <td className="text-end text-muted small">{row.sort_order}</td>
                  <td className="text-end">
                    <div className="d-inline-flex gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        title="Edit company"
                        onClick={() => openEdit(row)}
                      >
                        <i className="bi bi-pencil-square" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        title="Delete company"
                        onClick={() => setDeleteTarget(row)}
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
          <div className="modal-backdrop fade show" onClick={closeModal} />
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">
                    {editing ? 'Edit company' : 'Add company'}
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeModal}
                  />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Logo</label>
                    <div className="account-info-control account-info-control--logo">
                      {logoDisplayUrl ? (
                        <img
                          src={logoDisplayUrl}
                          alt=""
                          className="account-info-logo-preview"
                        />
                      ) : (
                        <span className="text-muted small">No logo uploaded</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control form-control-sm mt-2"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-name">
                      Name
                    </label>
                    <input
                      id="company-name"
                      type="text"
                      className="form-control"
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-website">
                      Website
                    </label>
                    <input
                      id="company-website"
                      type="url"
                      className="form-control"
                      placeholder="https://example.com"
                      value={form.website}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, website: e.target.value }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-timezone">
                      Timezone
                    </label>
                    <select
                      id="company-timezone"
                      className="form-select"
                      value={form.timezone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, timezone: e.target.value }))
                      }
                    >
                      <option value="">Choose…</option>
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-check mb-2">
                    <input
                      id="company-is-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                    <label className="form-check-label" htmlFor="company-is-active">
                      Active
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      id="company-is-main"
                      type="checkbox"
                      className="form-check-input"
                      checked={form.is_main}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          is_main: e.target.checked,
                        }))
                      }
                    />
                    <label className="form-check-label" htmlFor="company-is-main">
                      Main company
                    </label>
                    <div className="form-text">
                      Only one company can be marked as main per account.
                    </div>
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
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">Delete company</h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setDeleteTarget(null)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
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

export default CompaniesPanel
