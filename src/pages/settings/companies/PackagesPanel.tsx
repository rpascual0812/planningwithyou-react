import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useAuthSession } from '../../../context/AuthSessionContext'
import CompanyFilterSelect from '../../../components/CompanyFilterSelect'
import { useCompanyFilter } from '../../../hooks/useCompanyFilter'
import { useFeatureAccess } from '../../../hooks/useFeatureAccess'
import { companyNameForScope } from '../../../lib/companySelection'
import {
  createPackageVersion,
  fetchPackageVersions,
  type PackageVersionRecord,
} from '../../../services/packageVersions'
import {
  createPackage,
  deletePackage,
  fetchPackage,
  fetchPackages,
  formatPackagePrice,
  updatePackage,
  type PackageItemPayload,
  type PackageItemRecord,
  type PackagePayload,
  type PackageRecord,
} from '../../../services/packages'
import { fetchAllCompanyPackages, type CompanyPackageRecord } from '../../../services/companyPackages'
import { datetimeLocalToIso, formatLocalDateTime } from '../../../lib/calendarEventFormat'
import { showErrorToast, showSuccessToast } from '../../../utils/toast'

function nowDatetimeLocalValue(): string {
  return formatLocalDateTime(new Date())
}

function formatEffectivityDateTime(value: string | null): string {
  if (!value) return ''
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function pickDefaultVersionId(versions: PackageVersionRecord[]): number | null {
  const active = versions.filter((v) => v.is_active)
  const list = active.length > 0 ? active : versions
  return list[0]?.id ?? null
}

type PackageItemDraft = {
  key: string
  title: string
  price: string
  children: PackageItemDraft[]
}

let packageItemKeyCounter = 0

function nextPackageItemKey(): string {
  packageItemKeyCounter += 1
  return `item-${packageItemKeyCounter}`
}

function formatItemPriceLine(price: string): string {
  const trimmed = price.trim()
  if (!trimmed) return ''
  const n = Number.parseFloat(trimmed)
  if (Number.isNaN(n) || n === 0) return ''
  return formatPackagePrice(n)
}

function previewPackageDescription(description: string, maxLen = 48): string {
  const trimmed = description.trim()
  if (!trimmed) return '—'
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

function recordsToDrafts(items: PackageItemRecord[]): PackageItemDraft[] {
  return items.map((item) => ({
    key: `item-${item.id}`,
    title: item.title,
    price: item.price,
    children: recordsToDrafts(item.children ?? []),
  }))
}

function itemsToPayload(items: PackageItemDraft[]): PackageItemPayload[] {
  return items.map((item) => {
    const payload: PackageItemPayload = { title: item.title }
    const priceStr = item.price.trim()
    if (priceStr) {
      const n = Number.parseFloat(priceStr)
      if (!Number.isNaN(n)) payload.price = n.toFixed(2)
    }
    const children = itemsToPayload(item.children)
    if (children.length > 0) payload.children = children
    return payload
  })
}

function addItemToTree(
  items: PackageItemDraft[],
  parentKey: string | null,
  newItem: PackageItemDraft,
): PackageItemDraft[] {
  if (parentKey == null) return [...items, newItem]
  return items.map((item) => {
    if (item.key === parentKey) {
      return { ...item, children: [...item.children, newItem] }
    }
    return { ...item, children: addItemToTree(item.children, parentKey, newItem) }
  })
}

function removeItemFromTree(items: PackageItemDraft[], key: string): PackageItemDraft[] {
  return items
    .filter((item) => item.key !== key)
    .map((item) => ({ ...item, children: removeItemFromTree(item.children, key) }))
}

function findItemByKey(items: PackageItemDraft[], key: string): PackageItemDraft | null {
  for (const item of items) {
    if (item.key === key) return item
    const found = findItemByKey(item.children, key)
    if (found) return found
  }
  return null
}


function packageItemDepthLabel(depth: number): string | null {
  if (depth <= 0) return null
  if (depth === 1) return 'Sub-item'
  if (depth === 2) return 'Sub-sub-item'
  return `Level ${depth + 1}`
}

function countPackageItems(items: PackageItemDraft[]): number {
  return items.reduce((total, item) => total + 1 + countPackageItems(item.children), 0)
}

const PackagesPanel = () => {
  const { currentUser } = useAuthSession()
  const { canWrite: companiesWrite } = useFeatureAccess('companies_settings')
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
  } = useCompanyFilter()

  const [companyPackages, setCompanyPackages] = useState<CompanyPackageRecord[]>([])
  const [companyPackagesLoading, setCompanyPackagesLoading] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)

  const [packageVersions, setPackageVersions] = useState<PackageVersionRecord[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [selectedPackageVersionId, setSelectedPackageVersionId] = useState<number | null>(null)

  const [packages, setPackages] = useState<PackageRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showPackageModal, setShowPackageModal] = useState(false)
  const [editing, setEditing] = useState<PackageRecord | null>(null)
  const [packageCatalogId, setPackageCatalogId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [requiredDownpayment, setRequiredDownpayment] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [savedItems, setSavedItems] = useState<PackageItemDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [itemFormError, setItemFormError] = useState<string | null>(null)
  const [showItemModal, setShowItemModal] = useState(false)
  const [itemParentKey, setItemParentKey] = useState<string | null>(null)

  const [showVersionModal, setShowVersionModal] = useState(false)
  const [versionTitle, setVersionTitle] = useState('')
  const [versionDescription, setVersionDescription] = useState('')
  const [versionEffectivityDate, setVersionEffectivityDate] = useState(nowDatetimeLocalValue)
  const [versionIsActive, setVersionIsActive] = useState(true)
  const [versionSaving, setVersionSaving] = useState(false)
  const [versionFormError, setVersionFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<PackageRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCompanyPackages = useCallback(async (companyId: number) => {
    setCompanyPackagesLoading(true)
    try {
      const rows = await fetchAllCompanyPackages(companyId)
      setCompanyPackages(rows)
      setSelectedPackageId((prev) => {
        if (prev != null && rows.some((t) => t.id === prev)) return prev
        const firstActive = rows.find((t) => t.is_active)
        return firstActive?.id ?? rows[0]?.id ?? null
      })
    } catch (e) {
      setCompanyPackages([])
      setSelectedPackageId(null)
      setError(e instanceof Error ? e.message : 'Failed to load packages')
    } finally {
      setCompanyPackagesLoading(false)
    }
  }, [])

  const loadPackageVersions = useCallback(async (companyId: number) => {
    setVersionsLoading(true)
    try {
      const rows = await fetchPackageVersions(companyId)
      setPackageVersions(rows)
      setSelectedPackageVersionId((prev) => {
        if (prev != null && rows.some((v) => v.id === prev)) return prev
        return pickDefaultVersionId(rows)
      })
    } catch (e) {
      setPackageVersions([])
      setSelectedPackageVersionId(null)
      setError(e instanceof Error ? e.message : 'Failed to load package versions')
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeCompanyId == null) {
      setCompanyPackages([])
      setPackageVersions([])
      setSelectedPackageId(null)
      setSelectedPackageVersionId(null)
      return
    }
    void loadCompanyPackages(activeCompanyId)
    void loadPackageVersions(activeCompanyId)
  }, [activeCompanyId, loadCompanyPackages, loadPackageVersions])

  const loadPackages = useCallback(
    async (companyId: number, packageId: number, packageVersionId: number) => {
      setLoading(true)
      setError(null)
      try {
        setPackages(await fetchPackages(companyId, packageId, packageVersionId))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load packages')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (
      activeCompanyId == null ||
      selectedPackageId == null ||
      selectedPackageVersionId == null
    ) {
      setPackages([])
      return
    }
    void loadPackages(activeCompanyId, selectedPackageId, selectedPackageVersionId)
  }, [activeCompanyId, selectedPackageId, selectedPackageVersionId, loadPackages])

  const resetItemDraft = () => {
    setItemName('')
    setItemPrice('')
    setItemFormError(null)
    setItemParentKey(null)
  }

  const resetPackageItemFields = () => {
    resetItemDraft()
    setSavedItems([])
    setShowItemModal(false)
  }

  const openAddPackage = () => {
    setEditing(null)
    setPackageCatalogId(selectedPackageId)
    setDescription('')
    setTotalPrice('')
    setRequiredDownpayment('')
    setIsActive(packages.length === 0)
    resetPackageItemFields()
    setFormError(null)
    setShowPackageModal(true)
  }

  const openEditPackage = async (pkg: PackageRecord) => {
    setEditing(pkg)
    setPackageCatalogId(pkg.package)
    setDescription(pkg.description)
    setTotalPrice(pkg.total_price)
    setRequiredDownpayment(pkg.required_downpayment_amount ?? '')
    setIsActive(pkg.is_active)
    resetPackageItemFields()
    setFormError(null)
    setShowPackageModal(true)
    try {
      const full = await fetchPackage(pkg.id)
      setSavedItems(recordsToDrafts(full.items ?? []))
      setRequiredDownpayment(full.required_downpayment_amount ?? '')
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Failed to load package items')
    }
  }

  const closePackageModal = () => {
    setShowPackageModal(false)
    setEditing(null)
    setFormError(null)
    resetPackageItemFields()
  }

  const openItemModal = (parentKey: string | null = null) => {
    setItemParentKey(parentKey)
    setItemName('')
    setItemPrice('')
    setItemFormError(null)
    setShowItemModal(true)
  }

  const closeItemModal = () => {
    setShowItemModal(false)
    resetItemDraft()
  }

  const handleSaveItemToList = () => {
    const trimmedName = itemName.trim()
    if (!trimmedName) {
      setItemFormError('Item name is required.')
      return
    }
    const priceStr = itemPrice.trim()
    if (priceStr) {
      const priceNum = Number.parseFloat(priceStr)
      if (Number.isNaN(priceNum) || priceNum < 0) {
        setItemFormError('Enter a valid price (0 or greater).')
        return
      }
    }
    const newItem: PackageItemDraft = {
      key: nextPackageItemKey(),
      title: trimmedName,
      price: priceStr,
      children: [],
    }
    setSavedItems((prev) => addItemToTree(prev, itemParentKey, newItem))
    closeItemModal()
  }

  const removeSavedItem = (key: string) => {
    setSavedItems((prev) => removeItemFromTree(prev, key))
  }

  const openVersionModal = () => {
    setVersionTitle('')
    setVersionDescription('')
    setVersionEffectivityDate(nowDatetimeLocalValue())
    setVersionIsActive(true)
    setVersionFormError(null)
    setShowVersionModal(true)
  }

  const closeVersionModal = () => {
    setShowVersionModal(false)
    setVersionFormError(null)
  }

  const handleSaveVersion = async () => {
    const trimmedTitle = versionTitle.trim()
    if (!trimmedTitle) {
      setVersionFormError('Title is required.')
      return
    }
    if (activeCompanyId == null) {
      setVersionFormError('Select a company first.')
      return
    }
    if (!versionEffectivityDate.trim()) {
      setVersionFormError('Effectivity date is required.')
      return
    }

    setVersionSaving(true)
    setVersionFormError(null)
    try {
      const created = await createPackageVersion({
        title: trimmedTitle,
        description: versionDescription.trim(),
        effectivity_date: datetimeLocalToIso(versionEffectivityDate),
        is_active: versionIsActive,
        company: activeCompanyId,
      })
      showSuccessToast('Package version created.')
      closeVersionModal()
      await loadPackageVersions(activeCompanyId)
      setSelectedPackageVersionId(created.id)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setVersionFormError(message)
      showErrorToast(message)
    } finally {
      setVersionSaving(false)
    }
  }

  const handleSavePackage = async () => {
    if (packageCatalogId == null) {
      setFormError('Package is required.')
      return
    }
    const priceStr = totalPrice.trim()
    if (!priceStr) {
      setFormError('Total price is required.')
      return
    }
    const priceNum = Number.parseFloat(priceStr)
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setFormError('Enter a valid total price (0 or greater).')
      return
    }
    const downpaymentStr = requiredDownpayment.trim()
    let downpaymentNum = 0
    if (downpaymentStr) {
      downpaymentNum = Number.parseFloat(downpaymentStr)
      if (Number.isNaN(downpaymentNum) || downpaymentNum < 0) {
        setFormError('Enter a valid downpayment (0 or greater).')
        return
      }
      if (downpaymentNum > priceNum) {
        setFormError('Downpayment cannot exceed total price.')
        return
      }
    }
    if (!editing && activeCompanyId == null) {
      setFormError('Select a company first.')
      return
    }
    if (!editing && selectedPackageVersionId == null) {
      setFormError('Select a package version first.')
      return
    }

    setSaving(true)
    setFormError(null)
    const hadOtherActiveSibling =
      isActive && packages.some((pkg) => pkg.is_active && pkg.id !== editing?.id)
    const payload: PackagePayload = {
      package: packageCatalogId,
      description: description.trim(),
      total_price: priceNum.toFixed(2),
      required_downpayment_amount: downpaymentNum.toFixed(2),
      is_active: isActive,
      items: itemsToPayload(savedItems),
    }
    try {
      if (editing) {
        await updatePackage(editing.id, payload)
        showSuccessToast(
          hadOtherActiveSibling
            ? 'Package updated. Other package prices for this package and version were set to inactive.'
            : 'Package updated.',
        )
      } else {
        await createPackage({
          ...payload,
          company: activeCompanyId!,
          package_version: selectedPackageVersionId!,
        })
        showSuccessToast(
          hadOtherActiveSibling
            ? 'Package created. Other package prices for this package and version were set to inactive.'
            : 'Package created.',
        )
      }
      closePackageModal()
      if (
        activeCompanyId != null &&
        selectedPackageId != null &&
        selectedPackageVersionId != null
      ) {
        await loadPackages(activeCompanyId, selectedPackageId, selectedPackageVersionId)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Save failed'
      setFormError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (
      !deleteTarget ||
      activeCompanyId == null ||
      selectedPackageId == null ||
      selectedPackageVersionId == null
    ) {
      return
    }
    setDeleting(true)
    try {
      await deletePackage(deleteTarget.id)
      showSuccessToast('Package deleted.')
      setDeleteTarget(null)
      if (editing?.id === deleteTarget.id) closePackageModal()
      await loadPackages(activeCompanyId, selectedPackageId, selectedPackageVersionId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed'
      setError(message)
      showErrorToast(message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const itemParent = itemParentKey ? findItemByKey(savedItems, itemParentKey) : null
  const packageItemCount = countPackageItems(savedItems)

  const renderItemRows = (items: PackageItemDraft[], depth = 0): ReactElement[] =>
    items.flatMap((item) => {
      const priceLine = formatItemPriceLine(item.price)
      const depthLabel = packageItemDepthLabel(depth)
      const depthClass = `packages-modal-item-row--depth-${Math.min(depth, 3)}`
      const row = (
        <li
          key={item.key}
          className={`list-group-item packages-modal-item-row ${depthClass} d-flex align-items-start gap-2`}
          role="treeitem"
          aria-level={depth + 1}
        >
          {depth > 0 ? (
            <span className="packages-modal-item-tree-icon" aria-hidden="true">
              <i className="bi bi-arrow-return-right" />
            </span>
          ) : null}
          <div className="flex-grow-1 min-w-0">
            {depthLabel ? (
              <span className="packages-modal-item-depth-badge">{depthLabel}</span>
            ) : null}
            <div className="fw-semibold packages-modal-item-title">{item.title}</div>
            {priceLine ? <div className="text-muted small">{priceLine}</div> : null}
          </div>
          {companiesWrite && (
            <div className="d-flex flex-shrink-0 gap-1">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                title="Add sub-item"
                onClick={() => openItemModal(item.key)}
              >
                <i className="bi bi-plus-lg" />
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                title="Remove item"
                onClick={() => removeSavedItem(item.key)}
              >
                <i className="bi bi-trash3" />
              </button>
            </div>
          )}
        </li>
      )
      return [row, ...renderItemRows(item.children, depth + 1)]
    })

  const selectedCompanyName = companyNameForScope(
    companies,
    activeCompanyId,
    currentUser,
  )
  const selectedCompanyPackage = companyPackages.find((t) => t.id === selectedPackageId)
  const selectedVersion = packageVersions.find((v) => v.id === selectedPackageVersionId)
  const isFirstPackageInScope = !editing && packages.length === 0
  const isOnlyActivePackageInScope =
    editing != null && isActive && packages.filter((pkg) => pkg.is_active).length === 1
  const activeCheckboxLocked = isFirstPackageInScope || isOnlyActivePackageInScope
  const filtersLoading = companyPackagesLoading || versionsLoading
  const canManage =
    companiesWrite &&
    activeCompanyId != null &&
    selectedPackageId != null &&
    selectedPackageVersionId != null &&
    !companiesLoading &&
    !filtersLoading

  return (
    <div>
      <div className="row g-2 align-items-end mb-3">
        <CompanyFilterSelect
          id="packages-company"
          className="col-12 col-md-6"
          companies={companies}
          loading={companiesLoading}
          value={selectedCompanyId}
          onChange={setSelectedCompanyId}
        />
      </div>

      <div className="row g-2 align-items-end mb-3">
        <div className="col-sm-6 col-md-4">
          <label className="form-label mb-1" htmlFor="packages-package">
            Package
          </label>
          <select
            id="packages-package"
            className="form-select form-select-sm"
            value={selectedPackageId ?? ''}
            disabled={activeCompanyId == null || companyPackagesLoading || companyPackages.length === 0}
            onChange={(e) => {
              const id = Number(e.target.value)
              setSelectedPackageId(Number.isFinite(id) && id > 0 ? id : null)
            }}
          >
            {companyPackages.length === 0 ? (
              <option value="">No packages for this company</option>
            ) : (
              companyPackages.map((pkgOption) => (
                <option key={pkgOption.id} value={pkgOption.id}>
                  {pkgOption.name}
                  {!pkgOption.is_active ? ' (inactive)' : ''}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="col-sm-6 col-md-5">
          <label className="form-label mb-1" htmlFor="packages-version">
            Package version
          </label>
          <div className="input-group input-group-sm">
            <select
              id="packages-version"
              className="form-select"
              value={selectedPackageVersionId ?? ''}
              disabled={
                activeCompanyId == null || versionsLoading || packageVersions.length === 0
              }
              onChange={(e) => {
                const id = Number(e.target.value)
                setSelectedPackageVersionId(Number.isFinite(id) && id > 0 ? id : null)
              }}
            >
              {packageVersions.length === 0 ? (
                <option value="">No package versions</option>
              ) : (
                packageVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.title}
                    {version.effectivity_date
                      ? ` · ${formatEffectivityDateTime(version.effectivity_date)}`
                      : ''}
                    {!version.is_active ? ' (inactive)' : ''}
                  </option>
                ))
              )}
            </select>
            {companiesWrite && (
              <button
                type="button"
                className="btn btn-outline-primary"
                title="Add package version"
                disabled={activeCompanyId == null || companiesLoading}
                onClick={openVersionModal}
              >
                <i className="bi bi-plus-lg" />
              </button>
            )}
          </div>
        </div>
        {companiesWrite && (
          <div className="col-sm-6 col-md-auto d-flex align-items-end">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={openAddPackage}
              disabled={!canManage}
            >
              <i className="bi bi-plus-lg me-1" />
              Add package
            </button>
          </div>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {selectedCompanyName && selectedCompanyPackage && selectedVersion
            ? `${packages.length} package price${packages.length !== 1 ? 's' : ''} for ${selectedCompanyName} · ${selectedCompanyPackage.name} · ${selectedVersion.title}${selectedVersion.effectivity_date ? ` (${formatEffectivityDateTime(selectedVersion.effectivity_date)})` : ''}`
            : selectedCompanyName
              ? 'Select a package and package version to view package prices'
              : 'Select a company to view packages'}
        </span>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {companiesLoading || filtersLoading || (loading && packages.length === 0) ? (
        <div className="text-muted">Loading…</div>
      ) : activeCompanyId == null ? (
        <div className="text-muted small">Add an active company before managing packages.</div>
      ) : selectedPackageVersionId == null ? (
        <div className="text-muted small">
          {companiesWrite
            ? 'Add a package version for this company, or select one from the dropdown.'
            : 'Select a package version from the dropdown.'}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-muted small">
          {companiesWrite
            ? 'No packages yet for this version. Click "Add package" to create one.'
            : 'No packages yet for this version.'}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0 bookings-companyPackages-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Description</th>
                <th>Total price</th>
                <th className="bookings-companyPackages-table__active">Active</th>
                {companiesWrite && <th className="text-end">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="fw-semibold">{pkg.package_name}</td>
                  <td
                    className="text-muted small packages-table-description"
                    title={pkg.description.trim() || undefined}
                  >
                    {previewPackageDescription(pkg.description)}
                  </td>
                  <td>{formatPackagePrice(pkg.total_price)}</td>
                  <td className="bookings-companyPackages-table__active">
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
                          onClick={() => void openEditPackage(pkg)}
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

      {showPackageModal && (
        <>
          <div className="modal-backdrop fade show" onClick={closePackageModal} />
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">
                    {editing ? 'Edit package' : 'Add package'}
                  </h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closePackageModal}
                  />
                </div>
                <div className="modal-body">
                  {!editing && selectedCompanyName && selectedVersion && (
                    <p className="text-muted small mb-3">
                      Company: <strong>{selectedCompanyName}</strong>
                      <br />
                      Version: <strong>{selectedVersion.title}</strong>
                    </p>
                  )}
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-package">
                      Package *
                    </label>
                    <select
                      id="package-package"
                      className="form-select"
                      value={packageCatalogId ?? ''}
                      disabled={companyPackages.length === 0}
                      onChange={(e) => {
                        const id = Number(e.target.value)
                        setPackageCatalogId(Number.isFinite(id) && id > 0 ? id : null)
                      }}
                      autoFocus
                    >
                      {companyPackages.length === 0 ? (
                        <option value="">No companyPackages for this company</option>
                      ) : (
                        companyPackages.map((pkgOption) => (
                          <option key={pkgOption.id} value={pkgOption.id}>
                            {pkgOption.name}
                            {!pkgOption.is_active ? ' (inactive)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-description">
                      Description
                    </label>
                    <textarea
                      id="package-description"
                      className="form-control"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-total-price">
                      Total price *
                    </label>
                    <input
                      id="package-total-price"
                      type="number"
                      className="form-control"
                      min={0}
                      step="0.01"
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-required-downpayment">
                      Downpayment
                    </label>
                    <input
                      id="package-required-downpayment"
                      type="number"
                      className="form-control"
                      min={0}
                      step="0.01"
                      value={requiredDownpayment}
                      onChange={(e) => setRequiredDownpayment(e.target.value)}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="package-is-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={isActive}
                      disabled={activeCheckboxLocked}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="package-is-active">
                      Active
                    </label>
                    <div className="form-text">
                      {isFirstPackageInScope
                        ? 'The first package price for this package and version must be active.'
                        : 'Only one package price can be active per company, package, and version.'}
                    </div>
                  </div>

                  <div className="packages-modal-items-section mb-3">
                    <h3 className="packages-modal-items-heading">Items</h3>
                    <div className="border rounded p-3 bg-body-tertiary packages-modal-items-box">
                      {packageItemCount === 0 ? (
                        <p className="text-muted small mb-3">
                          No items yet. Click &quot;Add item&quot; to add line items to this package.
                        </p>
                      ) : (
                        <ul className="list-group list-group-flush packages-modal-item-list mb-3" role="tree">
                          {renderItemRows(savedItems)}
                        </ul>
                      )}
                      {companiesWrite && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openItemModal(null)}
                        >
                          <i className="bi bi-plus-lg me-1" />
                          Add item
                        </button>
                      )}
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
                    onClick={closePackageModal}
                    disabled={saving}
                  >
                    {companiesWrite ? 'Cancel' : 'Close'}
                  </button>
                  {companiesWrite && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleSavePackage()}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {showItemModal && (
            <>
              <div
                className="modal-backdrop fade show"
                style={{ zIndex: 1065 }}
                onClick={closeItemModal}
                aria-hidden="true"
              />
              <div
                className="modal fade show d-block"
                role="dialog"
                aria-modal="true"
                style={{ zIndex: 1070 }}
              >
                <div className="modal-dialog modal-dialog-centered">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h2 className="modal-title fs-5">
                        {itemParent ? 'Add sub-item' : 'Add item'}
                      </h2>
                      <button
                        type="button"
                        className="btn-close"
                        aria-label="Close"
                        onClick={closeItemModal}
                      />
                    </div>
                    <div className="modal-body">
                      {itemParent ? (
                        <p className="text-muted small mb-3">
                          Under: <strong>{itemParent.title}</strong>
                        </p>
                      ) : null}
                      <div className="border rounded p-3 bg-body-tertiary">
                        <div className="mb-3">
                          <label className="form-label" htmlFor="package-item-name">
                            Item name *
                          </label>
                          <input
                            id="package-item-name"
                            type="text"
                            className="form-control"
                            value={itemName}
                            onChange={(e) => setItemName(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="mb-0">
                          <label className="form-label" htmlFor="package-item-price">
                            Price <span className="text-muted fw-normal">(optional)</span>
                          </label>
                          <input
                            id="package-item-price"
                            type="number"
                            className="form-control"
                            min={0}
                            step="0.01"
                            value={itemPrice}
                            onChange={(e) => setItemPrice(e.target.value)}
                          />
                          <div className="form-text">
                            For your reference only. It will not be used in the total price.
                          </div>
                        </div>
                      </div>
                      {itemFormError && (
                        <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                          {itemFormError}
                        </div>
                      )}
                    </div>
                    <div className="modal-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closeItemModal}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSaveItemToList}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {showVersionModal && (
        <>
          <div className="modal-backdrop fade show" onClick={closeVersionModal} />
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5">Add package version</h2>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeVersionModal}
                  />
                </div>
                <div className="modal-body">
                  {selectedCompanyName && (
                    <p className="text-muted small mb-3">
                      Company: <strong>{selectedCompanyName}</strong>
                    </p>
                  )}
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-version-title">
                      Title *
                    </label>
                    <input
                      id="package-version-title"
                      type="text"
                      className="form-control"
                      value={versionTitle}
                      onChange={(e) => setVersionTitle(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-version-description">
                      Description
                    </label>
                    <textarea
                      id="package-version-description"
                      className="form-control"
                      rows={3}
                      value={versionDescription}
                      onChange={(e) => setVersionDescription(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="package-version-effectivity-date">
                      Effectivity date and time *
                    </label>
                    <input
                      id="package-version-effectivity-date"
                      type="datetime-local"
                      className="form-control"
                      value={versionEffectivityDate}
                      onChange={(e) => setVersionEffectivityDate(e.target.value)}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      id="package-version-is-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={versionIsActive}
                      onChange={(e) => setVersionIsActive(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="package-version-is-active">
                      Active
                    </label>
                  </div>
                  {versionFormError && (
                    <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                      {versionFormError}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeVersionModal}
                    disabled={versionSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSaveVersion()}
                    disabled={versionSaving}
                  >
                    {versionSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setDeleteTarget(null)} />
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
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
                    Delete the package price for <strong>{deleteTarget.package_name}</strong>? Line items
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

export default PackagesPanel
