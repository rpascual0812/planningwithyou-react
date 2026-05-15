import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteAccount,
  fetchAccountsBySupplierType,
  updateAccount,
  type AccountRecord,
} from '../../services/accounts'
import {
  fetchActiveSupplierTypes,
  type SupplierTypeRecord,
} from '../../services/supplierTypes'

const PAGE_SIZES = [10, 25, 50, 100] as const

function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

const SupplierSettingsPage = () => {
  const [types, setTypes] = useState<SupplierTypeRecord[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesError, setTypesError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')

  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pageSize, setPageSize] = useState<number>(10)
  const [page, setPage] = useState(0)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const [editTarget, setEditTarget] = useState<AccountRecord | null>(null)
  const [editName, setEditName] = useState('')
  const [editDiscount, setEditDiscount] = useState('')
  const [editPriceAdjustment, setEditPriceAdjustment] = useState('')
  const [editPrice, setEditPrice] = useState('')
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

  const loadAccounts = useCallback(async () => {
    if (!selectedId) {
      setAccounts([])
      return
    }
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const data = await fetchAccountsBySupplierType(
        Number(selectedId),
        debouncedSearch,
      )
      setAccounts(data)
      setPage(0)
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'Failed to load accounts')
      setAccounts([])
    } finally {
      setAccountsLoading(false)
    }
  }, [selectedId, debouncedSearch])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const total = accounts.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = useMemo(() => {
    const start = safePage * pageSize
    return accounts.slice(start, start + pageSize)
  }, [accounts, safePage, pageSize])

  const rangeStart = total === 0 ? 0 : safePage * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(total, (safePage + 1) * pageSize)

  const handleToggleActive = async (row: AccountRecord) => {
    if (togglingId === row.id) return
    const nextActive = !row.is_active
    setTogglingId(row.id)
    setAccounts((prev) =>
      prev.map((a) => (a.id === row.id ? { ...a, is_active: nextActive } : a)),
    )
    try {
      await updateAccount(row.id, { is_active: nextActive })
    } catch (e) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === row.id ? { ...a, is_active: row.is_active } : a)),
      )
      setAccountsError(
        e instanceof Error ? e.message : 'Failed to update account status',
      )
    } finally {
      setTogglingId(null)
    }
  }

  const openEdit = (row: AccountRecord) => {
    setEditTarget(row)
    setEditName(row.name)
    setEditDiscount(row.discount ?? '')
    setEditPriceAdjustment(row.price_adjustment ?? '')
    setEditPrice(row.price ?? '')
  }

  const closeEdit = () => {
    setEditTarget(null)
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await updateAccount(editTarget.id, {
        name: editName.trim() || editTarget.name,
        discount: editDiscount.trim() === '' ? null : editDiscount.trim(),
        price_adjustment:
          editPriceAdjustment.trim() === '' ? null : editPriceAdjustment.trim(),
        price: editPrice.trim() === '' ? null : editPrice.trim(),
      })
      closeEdit()
      await loadAccounts()
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: AccountRecord) => {
    if (!window.confirm(`Delete account "${row.name}"?`)) return
    try {
      await deleteAccount(row.id)
      await loadAccounts()
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'Failed to delete account')
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
              aria-label="Search accounts"
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
          {accountsLoading && accounts.length === 0 ? (
            <div className="users-table-empty-wrap">
              <span className="users-table-empty">Loading accounts…</span>
            </div>
          ) : accountsError ? (
            <div className="users-table-empty-wrap">
              <span className="users-table-empty users-table-error">{accountsError}</span>
            </div>
          ) : (
            <table className="users-table suppliers-accounts-table">
              <thead>
                <tr>
                  <th className="suppliers-th-active">Active</th>
                  <th>Name</th>
                  <th>Discount</th>
                  <th>Price Adjustment</th>
                  <th>Price</th>
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
                    <td>{formatMoney(row.discount)}</td>
                    <td>{formatMoney(row.price_adjustment)}</td>
                    <td>{formatMoney(row.price)}</td>
                    <td>
                      <div className="users-actions">
                        <button
                          type="button"
                          className="users-action-btn users-action-edit"
                          title="Edit account"
                          onClick={() => openEdit(row)}
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          type="button"
                          className="users-action-btn users-action-delete"
                          title="Delete account"
                          onClick={() => handleDelete(row)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && !accountsLoading && (
                  <tr>
                    <td colSpan={5} className="users-table-empty">
                      {!selectedId
                        ? 'Select a supplier type.'
                        : debouncedSearch
                          ? 'No accounts match your search.'
                          : 'No accounts for this supplier type.'}
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
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">Edit account</h2>
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeEdit} />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="edit-account-name">Name</label>
                    <input
                      id="edit-account-name"
                      className="form-control"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="edit-account-discount">Discount</label>
                    <input
                      id="edit-account-discount"
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="edit-account-price-adj">Price Adjustment</label>
                    <input
                      id="edit-account-price-adj"
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editPriceAdjustment}
                      onChange={(e) => setEditPriceAdjustment(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="edit-account-price">Price</label>
                    <input
                      id="edit-account-price"
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                    />
                  </div>

                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeEdit} disabled={saving}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
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
