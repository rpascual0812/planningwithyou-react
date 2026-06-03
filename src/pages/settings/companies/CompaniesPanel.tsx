import { useCallback, useEffect, useState } from 'react'
import EditModalHistoryTabs from '../../../components/EditModalHistoryTabs'
import ResourceHistoryPanel from '../../../components/ResourceHistoryPanel'
import { useAuthSession } from '../../../context/AuthSessionContext'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import { historyPaths } from '../../../services/history'
import { resizeImageFileToMaxWidth } from '../../../lib/resizeImageFile'
import { fetchSecuredFileBlobUrl } from '../../../lib/securedFileUrl'
import { fetchCurrentAccount } from '../../../services/accounts'
import {
  createCompany,
  deleteCompany,
  fetchCompanies,
  updateCompany,
  type CompanyPayload,
  type CompanyRecord,
} from '../../../services/companies'
import {
  fetchActiveSupplierTypes,
  type SupplierTypeRecord,
} from '../../../services/supplierTypes'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'
import TimezoneSelect from '../../../components/TimezoneSelect'
import { resolveTimezoneInput } from '../../../lib/timezones'
import CompanyKybModal from './CompanyKybModal'

const DEFAULT_MAX_BOOKINGS_PER_DAY = 1

const EMPTY_FORM = {
  name: '',
  timezone: '',
  contact_person: '',
  contact_email: '',
  phone_number: '',
  mobile_number: '',
  address: '',
  website: '',
  is_active: true,
  is_main: false,
  max_bookings_per_day: DEFAULT_MAX_BOOKINGS_PER_DAY,
  supplier_type: null as number | null,
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
  const { subscriptionPlan } = useAuthSession()
  const { canWrite: companiesWrite } = useFeatureAccess('companies_settings')
  const canAddCompany =
    companiesWrite &&
    subscriptionPlan != null &&
    subscriptionPlan !== 'free'
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [companyModalTab, setCompanyModalTab] = useState<'details' | 'history'>('details')
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [editing, setEditing] = useState<CompanyRecord | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CompanyRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [kybCompany, setKybCompany] = useState<CompanyRecord | null>(null)

  const [logoUrl, setLogoUrl] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoDisplayUrl, setLogoDisplayUrl] = useState('')
  const [logoResizing, setLogoResizing] = useState(false)

  const [supplierTypes, setSupplierTypes] = useState<SupplierTypeRecord[]>([])
  const [supplierTypesLoading, setSupplierTypesLoading] = useState(true)
  const [accountTimezone, setAccountTimezone] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchCompanies()
      setCompanies(list)
      return list
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    fetchCurrentAccount()
      .then((account) => {
        if (!cancelled) setAccountTimezone(account.timezone?.trim() ?? '')
      })
      .catch(() => {
        if (!cancelled) setAccountTimezone('')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setSupplierTypesLoading(true)
    fetchActiveSupplierTypes()
      .then((data) => {
        if (!cancelled) setSupplierTypes(data)
      })
      .catch(() => {
        if (!cancelled) setSupplierTypes([])
      })
      .finally(() => {
        if (!cancelled) setSupplierTypesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showModal || editing || supplierTypes.length === 0) return
    setForm((prev) =>
      prev.supplier_type == null
        ? { ...prev, supplier_type: supplierTypes[0].id }
        : prev,
    )
  }, [showModal, editing, supplierTypes])

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
    setLogoResizing(false)
  }

  const handleLogoFileChange = async (file: File | undefined) => {
    if (!file) {
      setLogoFile(null)
      return
    }
    setLogoResizing(true)
    setFormError(null)
    try {
      const resized = await resizeImageFileToMaxWidth(file, 200)
      setLogoFile(resized)
    } catch (e) {
      setLogoFile(null)
      setFormError(e instanceof Error ? e.message : 'Could not process logo image')
    } finally {
      setLogoResizing(false)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      ...EMPTY_FORM,
      timezone: accountTimezone,
      max_bookings_per_day: DEFAULT_MAX_BOOKINGS_PER_DAY,
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
      contact_person: row.contact_person ?? '',
      contact_email: row.contact_email ?? '',
      phone_number: row.phone_number ?? '',
      mobile_number: row.mobile_number ?? '',
      address: row.address ?? '',
      website: row.website ?? '',
      is_active: row.is_active,
      is_main: row.is_main,
      max_bookings_per_day:
        row.max_bookings_per_day >= 1
          ? row.max_bookings_per_day
          : DEFAULT_MAX_BOOKINGS_PER_DAY,
      supplier_type: row.supplier_type,
    })
    setLogoUrl(row.logo_url ?? '')
    setLogoFile(null)
    setLogoPreview(null)
    setFormError(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setCompanyModalTab('details')
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
    if (form.supplier_type == null) {
      setFormError('Supplier type is required.')
      return
    }
    if (form.max_bookings_per_day < 1) {
      setFormError('Bookings per day must be at least 1.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload: CompanyPayload = {
      name: trimmed,
      supplier_type: form.supplier_type,
      timezone: resolveTimezoneInput(form.timezone),
      contact_person: form.contact_person.trim(),
      contact_email: form.contact_email.trim(),
      phone_number: form.phone_number.trim(),
      mobile_number: form.mobile_number.trim(),
      address: form.address.trim(),
      website: form.website.trim(),
      is_active: form.is_active,
      is_main: form.is_main,
      max_bookings_per_day: form.max_bookings_per_day,
      ...(logoFile ? { logo: logoFile } : {}),
    }
    try {
      if (editing) {
        await updateCompany(editing.id, payload)
        setHistoryRefresh((k) => k + 1)
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
        {canAddCompany && (
          <button type="button" className="btn btn-sm btn-primary" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Add company
          </button>
        )}
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
                <th className="bookings-tiers-table__active">Verified</th>
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
                    {row.kyb_verified ? (
                      <span className="badge text-bg-success">Verified</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-link p-0 border-0 text-decoration-none"
                        title="Complete KYB verification"
                        onClick={() => setKybCompany(row)}
                      >
                        <span className="badge text-bg-danger">Unverified</span>
                      </button>
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
                    {companiesWrite && (
                      <div className="d-inline-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          title="Edit company"
                          onClick={() => openEdit(row)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        {!row.is_main && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Delete company"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        )}
                      </div>
                    )}
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
            <div className="modal-dialog modal-dialog-centered modal-lg">
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
                  <EditModalHistoryTabs
                    tab={companyModalTab}
                    onTab={setCompanyModalTab}
                    showHistory={editing != null}
                  />
                  {companyModalTab === 'history' && editing ? (
                    <ResourceHistoryPanel
                      historyPath={historyPaths.company(editing.id)}
                      refreshKey={historyRefresh}
                    />
                  ) : (
                  <>
                  <div className="mb-3">
                    <label className="form-label">
                      Logo{' '}
                      <span className="text-muted small">
                        (resized to 200px wide; height scales automatically)
                      </span>
                    </label>
                    <div className="account-info-control account-info-control--logo">
                      {logoResizing ? (
                        <span className="text-muted small">Resizing image…</span>
                      ) : logoDisplayUrl ? (
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
                        disabled={logoResizing || saving}
                        onChange={(e) => {
                          const picked = e.target.files?.[0]
                          void handleLogoFileChange(picked)
                          e.target.value = ''
                        }}
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
                  <TimezoneSelect
                    label="Timezone"
                    triggerId="company-timezone"
                    labelClassName="form-label"
                    wrapperClassName="mb-3"
                    value={form.timezone}
                    onChange={(timezone) =>
                      setForm((prev) => ({ ...prev, timezone }))
                    }
                  />
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-contact-person">
                      Contact person
                    </label>
                    <input
                      id="company-contact-person"
                      type="text"
                      className="form-control"
                      value={form.contact_person}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_person: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-contact-email">
                      Contact email address
                    </label>
                    <input
                      id="company-contact-email"
                      type="email"
                      className="form-control"
                      autoComplete="email"
                      value={form.contact_email}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-phone">
                      Phone number
                    </label>
                    <input
                      id="company-phone"
                      type="tel"
                      className="form-control"
                      value={form.phone_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          phone_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-mobile">
                      Mobile number
                    </label>
                    <input
                      id="company-mobile"
                      type="tel"
                      className="form-control"
                      value={form.mobile_number}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          mobile_number: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="company-address">
                      Address
                    </label>
                    <textarea
                      id="company-address"
                      className="form-control"
                      rows={3}
                      value={form.address}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, address: e.target.value }))
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <span className="form-label d-block">Supplier type</span>
                    {supplierTypesLoading ? (
                      <p className="text-muted small mb-0">Loading supplier types…</p>
                    ) : supplierTypes.length === 0 ? (
                      <p className="text-muted small mb-0">No supplier types available.</p>
                    ) : (
                      <div className="company-supplier-types-scroll">
                        <ul
                          className="settings-radio-list"
                          role="radiogroup"
                          aria-label="Supplier type"
                        >
                          {supplierTypes.map((type) => (
                            <li key={type.id}>
                              <label className="settings-radio">
                                <input
                                  type="radio"
                                  name="company-supplier-type"
                                  value={type.id}
                                  checked={form.supplier_type === type.id}
                                  onChange={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      supplier_type: type.id,
                                    }))
                                  }
                                />
                                <span>{type.name}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                  <div className="border rounded p-3 mt-3">
                    <div className="fw-semibold mb-3">Additional Information</div>
                    <label
                      className="form-label mb-2"
                      htmlFor="company-max-bookings-per-day"
                    >
                      How many bookings can you accept in a day?
                    </label>
                    <input
                      id="company-max-bookings-per-day"
                      type="number"
                      className="form-control"
                      min={1}
                      step={1}
                      value={form.max_bookings_per_day ?? DEFAULT_MAX_BOOKINGS_PER_DAY}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10)
                        setForm((prev) => ({
                          ...prev,
                          max_bookings_per_day: Number.isFinite(parsed)
                            ? Math.max(DEFAULT_MAX_BOOKINGS_PER_DAY, parsed)
                            : DEFAULT_MAX_BOOKINGS_PER_DAY,
                        }))
                      }}
                    />
                  </div>
                  {formError && (
                    <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                      {formError}
                    </div>
                  )}
                  </>
                  )}
                </div>
                <div className="modal-footer">
                  {editing && !editing.kyb_verified && (
                    <button
                      type="button"
                      className="btn btn-outline-success me-auto"
                      onClick={() => setKybCompany(editing)}
                      disabled={saving}
                    >
                      <i className="bi bi-shield-check me-1" />
                      Verify Your Business
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  {companiesWrite && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleSave()}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {kybCompany && (
        <CompanyKybModal
          companyId={kybCompany.id}
          companyName={kybCompany.name}
          onClose={() => setKybCompany(null)}
          onSaved={async () => {
            const list = await load()
            if (!list) return
            setEditing((prev) => {
              if (!prev || prev.id !== kybCompany.id) return prev
              return list.find((c) => c.id === prev.id) ?? prev
            })
          }}
        />
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
