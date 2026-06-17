import { useEffect, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  parseSupplierFieldValue,
  serializeSupplierFieldValue,
  type SupplierFieldValue,
} from '../lib/supplierFieldValue'
import {
  fetchBookingSupplierPackage,
  fetchSupplierBookingCapacity,
  fetchSupplierOptions,
  fetchTiersForSupplier,
  type BookingSupplierPackageRecord,
  type SupplierOptionRecord,
  type SupplierTierOptionRecord,
} from '../services/supplierField'
import PackageItemsPopover from './PackageItemsPopover'
import {
  fetchActiveSupplierTypes,
  type SupplierTypeRecord,
} from '../services/supplierTypes'

function CompanyKybIcon({ verified }: { verified: boolean }) {
  return verified ? (
    <i
      className="bi bi-shield-check text-success flex-shrink-0"
      title="KYB verified"
      aria-label="KYB verified"
    />
  ) : (
    <i
      className="bi bi-shield-exclamation text-danger flex-shrink-0"
      title="KYB not verified"
      aria-label="KYB not verified"
    />
  )
}

function supplierCapacityErrorMessage(supplierName: string): string {
  return `${supplierName} has reached the maximum allowed bookings for that day.`
}

type SupplierFieldInputProps = {
  value: string
  /** Tier price and package required downpayment for booking totals. */
  onChange: (
    value: string,
    price?: string | null,
    packageRequiredDownpayment?: string | null,
  ) => void
  required?: boolean
  /** Booking form ``Date of Booking`` (YYYY-MM-DD). */
  dateOfEvent?: string
  /** When editing a booking, exclude it from the daily capacity count. */
  excludeQuotationId?: number | null
  /** When set, supplier type is fixed by the field definition (customize fields). */
  fixedSupplierTypeId?: number | null
  tierLabel?: string
  packageLabel?: string
  supplierLabel?: string
  supplierTypeLabel?: string
  size?: 'sm' | 'default'
}

export default function SupplierFieldInput({
  value,
  onChange,
  required = false,
  dateOfEvent = '',
  excludeQuotationId = null,
  fixedSupplierTypeId = null,
  packageLabel = 'Package',
  supplierLabel = 'Supplier',
  supplierTypeLabel = 'Supplier type',
  size = 'default',
}: SupplierFieldInputProps) {
  const selectClass =
    size === 'sm' ? 'form-select form-select-sm' : 'form-select'
  const labelClass = size === 'sm' ? 'form-label small mb-1' : 'form-label'

  const parsed = parseSupplierFieldValue(value)
  const [supplierTypes, setSupplierTypes] = useState<SupplierTypeRecord[]>([])
  const [supplierTypeId, setSupplierTypeId] = useState<number | ''>('')
  const [suppliers, setSuppliers] = useState<SupplierOptionRecord[]>([])
  const [tiers, setTiers] = useState<SupplierTierOptionRecord[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingTiers, setLoadingTiers] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false)
  const [packageDetail, setPackageDetail] = useState<BookingSupplierPackageRecord | null>(
    null,
  )
  const [packageLoading, setPackageLoading] = useState(false)
  const supplierMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingTypes(true)
    fetchActiveSupplierTypes()
      .then((data) => {
        if (!cancelled) setSupplierTypes(data)
      })
      .catch(() => {
        if (!cancelled) setSupplierTypes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTypes(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (fixedSupplierTypeId == null) return
    setSupplierTypeId(fixedSupplierTypeId)
  }, [fixedSupplierTypeId])

  useEffect(() => {
    if (fixedSupplierTypeId != null) return
    if (parsed.supplier_id == null || supplierTypeId !== '') return
    let cancelled = false
    fetchSupplierOptions({ supplierId: parsed.supplier_id })
      .then((data) => {
        if (cancelled) return
        const match = data.find((row) => row.id === parsed.supplier_id)
        if (match?.supplier_type_id != null) {
          setSupplierTypeId(match.supplier_type_id)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [parsed.supplier_id, supplierTypeId, fixedSupplierTypeId])

  useEffect(() => {
    if (supplierTypeId === '') {
      setSuppliers([])
      return
    }
    let cancelled = false
    setLoadingSuppliers(true)
    setLoadError('')
    fetchSupplierOptions({
      supplierTypeId: supplierTypeId,
      supplierId: parsed.supplier_id ?? undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setSuppliers(data)
          if (data.length === 0) {
            setLoadError(
              'No active suppliers for this type. Enable them in Supplier Settings.',
            )
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load suppliers.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSuppliers(false)
      })
    return () => {
      cancelled = true
    }
  }, [supplierTypeId, parsed.supplier_id])

  useEffect(() => {
    if (parsed.supplier_id == null) {
      setTiers([])
      return
    }
    let cancelled = false
    setLoadingTiers(true)
    setLoadError('')
    fetchTiersForSupplier(parsed.supplier_id)
      .then((data) => {
        if (!cancelled) {
          setTiers(data)
          if (data.length === 0) {
            setLoadError(
              'No tiers configured for this supplier in Supplier Settings.',
            )
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTiers([])
          setLoadError('Could not load tiers for this supplier.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTiers(false)
      })
    return () => {
      cancelled = true
    }
  }, [parsed.supplier_id])

  const selectedTierOption =
    parsed.tier_id != null ? tiers.find((t) => t.id === parsed.tier_id) : undefined

  useEffect(() => {
    const companyId = parsed.supplier_id
    const tierId = parsed.tier_id
    if (companyId == null || tierId == null) {
      setPackageDetail(null)
      return
    }
    let cancelled = false
    setPackageLoading(true)
    void fetchBookingSupplierPackage({
      companyId,
      tierId,
      packageVersionId: selectedTierOption?.package_version_id ?? null,
    })
      .then((pkg) => {
        if (!cancelled) setPackageDetail(pkg)
      })
      .catch(() => {
        if (!cancelled) setPackageDetail(null)
      })
      .finally(() => {
        if (!cancelled) setPackageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [parsed.supplier_id, parsed.tier_id, selectedTierOption?.package_version_id])

  const emit = (
    next: SupplierFieldValue,
    packageRequiredDownpayment?: string | null,
  ) => {
    onChange(
      serializeSupplierFieldValue({
        tier_id: next.tier_id,
        supplier_id: next.supplier_id,
      }),
      next.price ?? null,
      packageRequiredDownpayment ?? null,
    )
  }

  const handleSupplierTypeChange = (typeId: string) => {
    const nextTypeId = typeId === '' ? '' : Number(typeId)
    setSupplierTypeId(nextTypeId)
    setSupplierMenuOpen(false)
    emit({ supplier_id: null, tier_id: null, price: null })
  }

  const showSupplierCapacityError = async (supplierName: string) => {
    await Swal.fire({
      icon: 'error',
      title: 'Quotation limit reached',
      text: supplierCapacityErrorMessage(supplierName),
    })
  }

  const isSupplierAtCapacity = async (supplierId: number): Promise<boolean> => {
    const eventDate = dateOfEvent.trim()
    if (!eventDate) return false
    try {
      const result = await fetchSupplierBookingCapacity({
        supplierId,
        dateOfEvent: eventDate,
        excludeQuotationId,
      })
      return result.at_capacity
    } catch {
      return false
    }
  }

  const handleSupplierChange = async (supplierId: string) => {
    if (supplierId === '') {
      setSupplierMenuOpen(false)
      emit({ supplier_id: null, tier_id: null, price: null })
      return
    }
    const supplier_id = Number(supplierId)
    const supplier = suppliers.find((s) => s.id === supplier_id)
    if (dateOfEvent.trim()) {
      const atCapacity = await isSupplierAtCapacity(supplier_id)
      if (atCapacity) {
        await showSupplierCapacityError(supplier?.name ?? 'This supplier')
        setSupplierMenuOpen(false)
        emit({ supplier_id: null, tier_id: null, price: null })
        return
      }
    }
    setSupplierMenuOpen(false)
    emit({ supplier_id, tier_id: null, price: null })
  }

  const handleTierChange = (tierId: string) => {
    const tier_id = tierId === '' ? null : Number(tierId)
    const tier = tier_id == null ? null : tiers.find((t) => t.id === tier_id)
    emit(
      {
        supplier_id: parsed.supplier_id,
        tier_id,
        price: tier?.price ?? null,
      },
      tier?.required_downpayment_amount ?? null,
    )
  }

  const supplierStillValid =
    parsed.supplier_id == null ||
    suppliers.some((s) => s.id === parsed.supplier_id)

  const selectedSupplier =
    supplierStillValid && parsed.supplier_id != null
      ? suppliers.find((s) => s.id === parsed.supplier_id)
      : undefined

  useEffect(() => {
    const eventDate = dateOfEvent.trim()
    if (!eventDate || parsed.supplier_id == null) return
    let cancelled = false
    void (async () => {
      const supplierId = parsed.supplier_id as number
      const atCapacity = await isSupplierAtCapacity(supplierId)
      if (cancelled || !atCapacity) return
      const supplierName =
        suppliers.find((s) => s.id === supplierId)?.name ?? 'This supplier'
      await showSupplierCapacityError(supplierName)
      emit({ supplier_id: null, tier_id: null, price: null })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateOfEvent, excludeQuotationId])

  useEffect(() => {
    if (!supplierMenuOpen) return
    const close = (event: MouseEvent) => {
      if (
        supplierMenuRef.current &&
        !supplierMenuRef.current.contains(event.target as Node)
      ) {
        setSupplierMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [supplierMenuOpen])

  const tierStillValid =
    parsed.tier_id == null || tiers.some((t) => t.id === parsed.tier_id)

  useEffect(() => {
    if (parsed.tier_id == null || !tierStillValid) return
    const tier = tiers.find((t) => t.id === parsed.tier_id)
    if (!tier?.price || parsed.price === tier.price) return
    emit({
      supplier_id: parsed.supplier_id,
      tier_id: parsed.tier_id,
      price: tier.price,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers, parsed.tier_id, parsed.supplier_id, tierStillValid])

  return (
    <div className="row g-2">
      {fixedSupplierTypeId == null && (
        <div className="col-12">
          <label className={labelClass}>{supplierTypeLabel}</label>
          <select
            className={selectClass}
            value={supplierTypeId}
            onChange={(e) => handleSupplierTypeChange(e.target.value)}
            required={required}
            disabled={loadingTypes}
          >
            <option value="">
              {loadingTypes
                ? 'Loading supplier types...'
                : supplierTypes.length === 0
                  ? 'No supplier types available'
                  : 'Select supplier type...'}
            </option>
            {supplierTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="col-sm-6">
        <label className={labelClass}>{supplierLabel}</label>
        <div className="position-relative" ref={supplierMenuRef}>
          <button
            type="button"
            className={`${selectClass} text-start d-flex align-items-center justify-content-between gap-2 w-100`}
            onClick={() => {
              if (supplierTypeId !== '' && !loadingSuppliers && suppliers.length > 0) {
                setSupplierMenuOpen((open) => !open)
              }
            }}
            disabled={supplierTypeId === '' || loadingSuppliers || suppliers.length === 0}
            aria-haspopup="listbox"
            aria-expanded={supplierMenuOpen}
          >
            <span className="d-flex align-items-center gap-2 min-w-0 text-truncate">
              {selectedSupplier ? (
                <>
                  <CompanyKybIcon verified={selectedSupplier.kyb_verified} />
                  <span className="text-truncate">{selectedSupplier.name}</span>
                </>
              ) : (
                <span className="text-muted">
                  {supplierTypeId === ''
                    ? 'Select a supplier type first'
                    : loadingSuppliers
                      ? 'Loading suppliers...'
                      : suppliers.length === 0
                        ? 'No suppliers available'
                        : 'Select supplier...'}
                </span>
              )}
            </span>
          </button>
          {supplierMenuOpen && suppliers.length > 0 && (
            <ul
              className="dropdown-menu show w-100"
              role="listbox"
              style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1050 }}
            >
              {suppliers.map((supplier) => (
                <li key={supplier.id}>
                  <button
                    type="button"
                    className={`dropdown-item d-flex align-items-center gap-2${
                      supplier.id === parsed.supplier_id ? ' active' : ''
                    }`}
                    role="option"
                    aria-selected={supplier.id === parsed.supplier_id}
                    onClick={() => void handleSupplierChange(String(supplier.id))}
                  >
                    <CompanyKybIcon verified={supplier.kyb_verified} />
                    <span>{supplier.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {required && supplierTypeId !== '' && (
          <input
            tabIndex={-1}
            required
            value={parsed.supplier_id != null ? '1' : ''}
            readOnly
            onChange={() => {}}
            style={{
              opacity: 0,
              height: 0,
              width: 0,
              position: 'absolute',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="col-sm-6">
        <label className={labelClass}>{packageLabel}</label>
        <div className="d-flex align-items-stretch gap-1">
          <select
            className={`${selectClass} flex-grow-1 min-w-0`}
            value={tierStillValid && parsed.tier_id != null ? parsed.tier_id : ''}
            onChange={(e) => handleTierChange(e.target.value)}
            required={required && parsed.supplier_id != null}
            disabled={
              parsed.supplier_id == null || loadingTiers || tiers.length === 0
            }
          >
            <option value="">
              {parsed.supplier_id == null
                ? 'Select a supplier first'
                : loadingTiers
                  ? 'Loading packages...'
                  : tiers.length === 0
                    ? 'No packages for this supplier'
                    : 'Select package...'}
            </option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
          {parsed.tier_id != null && parsed.supplier_id != null && (
            <PackageItemsPopover
              tierName={
                tiers.find((t) => t.id === parsed.tier_id)?.name ?? packageLabel
              }
              packageDescription={packageDetail?.description ?? ''}
              items={packageDetail?.items ?? []}
              loading={packageLoading}
            />
          )}
        </div>
      </div>
      {loadError && (
        <div className="col-12">
          <small className="text-danger">{loadError}</small>
        </div>
      )}
    </div>
  )
}
