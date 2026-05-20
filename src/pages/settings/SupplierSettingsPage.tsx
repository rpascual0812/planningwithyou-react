import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCompanyTierPricing,
  updateCompanyTierPricing,
  type CompanyTierPricingRow,
  type TierAdjustmentType,
} from '../../services/companyTierPricing'
import {
  deleteCompany,
  fetchCompaniesBySupplierType,
  updateCompany,
  type CompanyRecord,
  type CompanySupplierTierSummary,
} from '../../services/companies'
import {
  fetchActiveSupplierTypes,
  type SupplierTypeRecord,
} from '../../services/supplierTypes'

const PAGE_SIZES = [10, 25, 50, 100] as const

type TierPricingFormRow = {
  tier_id: number
  tier_name: string
  original_price: string | null
  discount: string
  discount_type: TierAdjustmentType
  mark_up: string
  mark_up_type: TierAdjustmentType
}

function parseAdjustmentValue(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function adjustmentAmount(
  base: number,
  value: number | null,
  type: TierAdjustmentType,
): number {
  if (value === null) return 0
  if (type === 'fixed') return value
  return (base * value) / 100
}

function computeFinalPrice(row: TierPricingFormRow): string | null {
  if (row.original_price === null || row.original_price === '') return null
  const base = Number(row.original_price)
  if (!Number.isFinite(base)) return null
  const discount = parseAdjustmentValue(row.discount)
  const markUp = parseAdjustmentValue(row.mark_up)
  if (discount === null && markUp === null) {
    return String(base)
  }
  let total = base
  if (discount !== null) {
    total -= adjustmentAmount(base, discount, row.discount_type)
  }
  if (markUp !== null) {
    total += adjustmentAmount(base, markUp, row.mark_up_type)
  }
  if (total < 0) total = 0
  return String(Math.round(total * 100) / 100)
}

function formatPercentValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return value
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
  return `${text}%`
}

function formatAdjustmentValue(
  value: string | null | undefined,
  type: TierAdjustmentType | undefined,
  currencyCode: string,
): string {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'percent') return formatPercentValue(value)
  return formatMoney(value, currencyCode)
}

function formatMoney(
  value: string | null | undefined,
  currencyCode = 'USD',
): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return value
  const code = currencyCode.trim() || 'USD'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    }).format(n)
  } catch {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(n)
  }
}

function formatTierColumn(
  tiers: CompanySupplierTierSummary[] | undefined,
  field: 'discount' | 'mark_up' | 'original_price' | 'price',
  currencyCode = 'USD',
) {
  if (!tiers || tiers.length === 0) return <span>—</span>
  return (
    <ul className="suppliers-tier-value-list list-unstyled mb-0">
      {tiers.map((tier) => {
        let display: string
        if (field === 'discount') {
          display = formatAdjustmentValue(
            tier.discount,
            tier.discount_type ?? 'percent',
            currencyCode,
          )
        } else if (field === 'mark_up') {
          display = formatAdjustmentValue(
            tier.mark_up,
            tier.mark_up_type ?? 'percent',
            currencyCode,
          )
        } else {
          display = formatMoney(tier[field], currencyCode)
        }
        return (
          <li key={tier.tier_id} className="suppliers-tier-value-list__row">
            <span className="suppliers-tier-value-list__name">{tier.tier_name}</span>
            <span className="suppliers-tier-value-list__value">{display}</span>
          </li>
        )
      })}
    </ul>
  )
}

function tierRowToForm(row: CompanyTierPricingRow): TierPricingFormRow {
  return {
    tier_id: row.tier_id,
    tier_name: row.tier_name,
    original_price: row.original_price,
    discount: row.discount ?? '',
    discount_type: row.discount_type ?? 'percent',
    mark_up: row.mark_up ?? '',
    mark_up_type: row.mark_up_type ?? 'percent',
  }
}

const SupplierSettingsPage = () => {
  const [types, setTypes] = useState<SupplierTypeRecord[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesError, setTypesError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')

  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pageSize, setPageSize] = useState<number>(10)
  const [page, setPage] = useState(0)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const [editTarget, setEditTarget] = useState<CompanyRecord | null>(null)
  const [editName, setEditName] = useState('')
  const [tierPricing, setTierPricing] = useState<TierPricingFormRow[]>([])
  const [tierPricingLoading, setTierPricingLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadTypes = useCallback(async () => {
    setTypesLoading(true)
    setTypesError(null)
    try {
      const data = await fetchActiveSupplierTypes()
      setTypes(data)
      setSelectedId((prev) => {
        if (prev && data.some((t) => String(t.id) === prev)) return prev
        return data.length > 0 ? String(data[0].id) : ''
      })
    } catch (e) {
      setTypesError(e instanceof Error ? e.message : 'Failed to load supplier types')
      setTypes([])
      setSelectedId('')
    } finally {
      setTypesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTypes()
  }, [loadTypes])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const loadCompanies = useCallback(async () => {
    if (!selectedId) {
      setCompanies([])
      return
    }
    setCompaniesLoading(true)
    setCompaniesError(null)
    try {
      const data = await fetchCompaniesBySupplierType(
        Number(selectedId),
        debouncedSearch,
      )
      setCompanies(data)
      setPage(0)
    } catch (e) {
      setCompaniesError(e instanceof Error ? e.message : 'Failed to load companies')
      setCompanies([])
    } finally {
      setCompaniesLoading(false)
    }
  }, [selectedId, debouncedSearch])

  useEffect(() => {
    loadCompanies()
  }, [loadCompanies])

  const total = companies.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = useMemo(() => {
    const start = safePage * pageSize
    return companies.slice(start, start + pageSize)
  }, [companies, safePage, pageSize])

  const rangeStart = total === 0 ? 0 : safePage * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, (safePage + 1) * pageSize)

  const handleToggleActive = async (row: CompanyRecord) => {
    if (togglingId === row.id) return
    const nextActive = !row.is_active
    setTogglingId(row.id)
    setCompanies((prev) =>
      prev.map((c) => (c.id === row.id ? { ...c, is_active: nextActive } : c)),
    )
    try {
      const updated = await updateCompany(
        row.id,
        { is_active: nextActive },
        { supplierDirectory: true },
      )
      setCompanies((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, is_active: updated.is_active } : c)),
      )
    } catch (e) {
      setCompanies((prev) =>
        prev.map((c) => (c.id === row.id ? { ...c, is_active: row.is_active } : c)),
      )
      setCompaniesError(
        e instanceof Error ? e.message : 'Failed to update supplier status',
      )
    } finally {
      setTogglingId(null)
    }
  }

  const openEdit = async (row: CompanyRecord) => {
    setEditTarget(row)
    setEditName(row.name)
    setTierPricing([])
    setTierPricingLoading(true)
    setCompaniesError(null)
    try {
      const data = await fetchCompanyTierPricing(row.id, { supplierDirectory: true })
      setEditName(data.name)
      setTierPricing(data.tiers.map(tierRowToForm))
    } catch (e) {
      setCompaniesError(
        e instanceof Error ? e.message : 'Failed to load tier pricing',
      )
      setEditTarget(null)
    } finally {
      setTierPricingLoading(false)
    }
  }

  const closeEdit = () => {
    setEditTarget(null)
    setTierPricing([])
  }

  const updateTierField = (
    tierId: number,
    field: 'discount' | 'mark_up' | 'discount_type' | 'mark_up_type',
    value: string,
  ) => {
    setTierPricing((prev) =>
      prev.map((row) =>
        row.tier_id === tierId ? { ...row, [field]: value } : row,
      ),
    )
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    setCompaniesError(null)
    try {
      await updateCompanyTierPricing(
        editTarget.id,
        {
          name: editName.trim() || editTarget.name,
          tiers: tierPricing.map((row) => ({
            tier_id: row.tier_id,
            discount: row.discount.trim() === '' ? null : row.discount.trim(),
            discount_type: row.discount_type,
            mark_up: row.mark_up.trim() === '' ? null : row.mark_up.trim(),
            mark_up_type: row.mark_up_type,
          })),
        },
        { supplierDirectory: true },
      )
      closeEdit()
      await loadCompanies()
    } catch (e) {
      setCompaniesError(e instanceof Error ? e.message : 'Failed to update company')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: CompanyRecord) => {
    if (!window.confirm(`Delete company "${row.name}"?`)) return
    try {
      await deleteCompany(row.id, { supplierDirectory: true })
      await loadCompanies()
    } catch (e) {
      setCompaniesError(e instanceof Error ? e.message : 'Failed to delete company')
    }
  }

  return (
    <div className="account-settings suppliers-settings">
      <div className="settings-supplier-toolbar">
        <label htmlFor="supplier-type-select" className="form-label mb-0">
          Supplier type
        </label>
        <select
          id="supplier-type-select"
          className="form-select form-select-sm settings-supplier-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={typesLoading || types.length === 0}
        >
          {typesLoading && <option value="">Loading…</option>}
          {!typesLoading && types.length === 0 && (
            <option value="">No supplier types</option>
          )}
          {!typesLoading &&
            types.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
        </select>
      </div>

      {typesError && (
        <div className="alert alert-danger py-2 mt-2" role="alert">
          {typesError}
        </div>
      )}

      <div className="users-table-card suppliers-accounts-card mt-3">
        <div className="users-table-toolbar suppliers-accounts-toolbar">
          <div className="suppliers-table-controls-left">
            <label className="suppliers-show-entries">
              Show
              <select
                className="form-select form-select-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(0)
                }}
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              entries
            </label>
          </div>
          <div className="users-search suppliers-table-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              className="users-search-input"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search companies"
              disabled={!selectedId}
            />
            {search && (
              <button
                type="button"
                className="users-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <i className="bi bi-x-lg" />
              </button>
            )}
          </div>
        </div>

        <div className="users-table-scroll">
          {companiesLoading && companies.length === 0 ? (
            <div className="users-table-empty-wrap">
              <span className="users-table-empty">Loading companies…</span>
            </div>
          ) : companiesError && !editTarget ? (
            <div className="users-table-empty-wrap">
              <span className="users-table-empty users-table-error">{companiesError}</span>
            </div>
          ) : (
            <table className="users-table suppliers-accounts-table">
              <thead>
                <tr>
                  <th className="suppliers-th-active">Active</th>
                  <th>Name</th>
                  <th>Original price</th>
                  <th>Discount</th>
                  <th>Mark-up</th>
                  <th>Final price</th>
                  <th className="users-th-actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="users-table-row">
                    <td className="suppliers-td-active">
                      <button
                        type="button"
                        role="switch"
                        className={`settings-switch${row.is_active ? ' is-on' : ''}`}
                        aria-checked={row.is_active}
                        aria-label={`${row.is_active ? 'Deactivate' : 'Activate'} ${row.name}`}
                        disabled={togglingId === row.id}
                        onClick={() => handleToggleActive(row)}
                      >
                        <span className="settings-switch-thumb" aria-hidden="true" />
                      </button>
                    </td>
                    <td className="users-table-name">{row.name}</td>
                    <td>
                      {formatTierColumn(
                        row.supplier_tiers,
                        'original_price',
                        row.currency_code,
                      )}
                    </td>
                    <td>
                      {formatTierColumn(row.supplier_tiers, 'discount', row.currency_code)}
                    </td>
                    <td>
                      {formatTierColumn(row.supplier_tiers, 'mark_up', row.currency_code)}
                    </td>
                    <td>
                      {formatTierColumn(row.supplier_tiers, 'price', row.currency_code)}
                    </td>
                    <td>
                      <div className="users-actions">
                        <button
                          type="button"
                          className="users-action-btn users-action-edit"
                          title="Edit supplier"
                          onClick={() => void openEdit(row)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          className="users-action-btn users-action-delete"
                          title="Delete company"
                          onClick={() => handleDelete(row)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && !companiesLoading && (
                  <tr>
                    <td colSpan={7} className="users-table-empty">
                      {!selectedId
                        ? 'Select a supplier type.'
                        : debouncedSearch
                          ? 'No companies match your search.'
                          : 'No companies for this supplier type.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="suppliers-table-footer">
          <span className="suppliers-table-info">
            Showing {rangeStart} to {rangeEnd} of {total} entries
          </span>
          <div className="suppliers-table-pager">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {editTarget && (
        <>
          <div className="modal-backdrop fade show" onClick={closeEdit} />
          <div
            className="modal fade show d-block supplier-edit-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">Edit supplier</h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeEdit}
                  />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="edit-company-name">
                      Name
                    </label>
                    <input
                      id="edit-company-name"
                      className="form-control"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={tierPricingLoading}
                    />
                  </div>

                  {tierPricingLoading ? (
                    <p className="text-muted small mb-0">Loading tiers…</p>
                  ) : tierPricing.length === 0 ? (
                    <p className="text-muted small mb-0">
                      No tiers configured for this company.
                    </p>
                  ) : (
                    <div className="supplier-tier-pricing-cards">
                      {tierPricing.map((tier) => (
                        <div
                          key={tier.tier_id}
                          className="supplier-tier-pricing-card"
                        >
                          <h3 className="supplier-tier-pricing-card__title">
                            {tier.tier_name}
                          </h3>
                          <p className="text-muted small mb-2">
                            Original price:{' '}
                            {formatMoney(tier.original_price, editTarget.currency_code)}
                          </p>
                          <div className="row g-2">
                            <div className="col-sm-4">
                              <label
                                className="form-label"
                                htmlFor={`tier-discount-${tier.tier_id}`}
                              >
                                Discount
                              </label>
                              <div className="input-group input-group-sm">
                                <input
                                  id={`tier-discount-${tier.tier_id}`}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-control"
                                  value={tier.discount}
                                  onChange={(e) =>
                                    updateTierField(
                                      tier.tier_id,
                                      'discount',
                                      e.target.value,
                                    )
                                  }
                                />
                                <select
                                  className="form-select"
                                  aria-label="Discount type"
                                  value={tier.discount_type}
                                  onChange={(e) =>
                                    updateTierField(
                                      tier.tier_id,
                                      'discount_type',
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="percent">Percent</option>
                                  <option value="fixed">Amount</option>
                                </select>
                              </div>
                            </div>
                            <div className="col-sm-4">
                              <label
                                className="form-label"
                                htmlFor={`tier-markup-${tier.tier_id}`}
                              >
                                Mark-up
                              </label>
                              <div className="input-group input-group-sm">
                                <input
                                  id={`tier-markup-${tier.tier_id}`}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-control"
                                  value={tier.mark_up}
                                  onChange={(e) =>
                                    updateTierField(
                                      tier.tier_id,
                                      'mark_up',
                                      e.target.value,
                                    )
                                  }
                                />
                                <select
                                  className="form-select"
                                  aria-label="Mark-up type"
                                  value={tier.mark_up_type}
                                  onChange={(e) =>
                                    updateTierField(
                                      tier.tier_id,
                                      'mark_up_type',
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="percent">Percent</option>
                                  <option value="fixed">Amount</option>
                                </select>
                              </div>
                            </div>
                            <div className="col-sm-4">
                              <span className="form-label d-block">Final price</span>
                              <p className="supplier-tier-final-price mb-0">
                                {formatMoney(
                                  computeFinalPrice(tier),
                                  editTarget.currency_code,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {companiesError && editTarget && (
                    <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                      {companiesError}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSaveEdit()}
                    disabled={saving || tierPricingLoading}
                  >
                    {saving ? 'Saving…' : 'Save'}
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

export default SupplierSettingsPage
