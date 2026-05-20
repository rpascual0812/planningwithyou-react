import { useEffect, useState } from 'react'
import {
  parseSupplierFieldValue,
  serializeSupplierFieldValue,
  type SupplierFieldValue,
} from '../lib/supplierFieldValue'
import {
  fetchSupplierOptions,
  fetchTiersForSupplier,
  type SupplierOptionRecord,
  type SupplierTierOptionRecord,
} from '../services/supplierField'
import {
  fetchActiveSupplierTypes,
  type SupplierTypeRecord,
} from '../services/supplierTypes'

type SupplierFieldInputProps = {
  value: string
  /** Second argument is tier price for ``booking_items.price``. */
  onChange: (value: string, price?: string | null) => void
  required?: boolean
  tierLabel?: string
  supplierLabel?: string
  supplierTypeLabel?: string
  size?: 'sm' | 'default'
}

export default function SupplierFieldInput({
  value,
  onChange,
  required = false,
  tierLabel = 'Tier',
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
  }, [parsed.supplier_id, supplierTypeId])

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

  const emit = (next: SupplierFieldValue) => {
    onChange(
      serializeSupplierFieldValue({
        tier_id: next.tier_id,
        supplier_id: next.supplier_id,
      }),
      next.price ?? null,
    )
  }

  const handleSupplierTypeChange = (typeId: string) => {
    const nextTypeId = typeId === '' ? '' : Number(typeId)
    setSupplierTypeId(nextTypeId)
    emit({ supplier_id: null, tier_id: null, price: null })
  }

  const handleSupplierChange = (supplierId: string) => {
    const supplier_id = supplierId === '' ? null : Number(supplierId)
    emit({ supplier_id, tier_id: null, price: null })
  }

  const handleTierChange = (tierId: string) => {
    const tier_id = tierId === '' ? null : Number(tierId)
    const tier = tier_id == null ? null : tiers.find((t) => t.id === tier_id)
    emit({
      supplier_id: parsed.supplier_id,
      tier_id,
      price: tier?.price ?? null,
    })
  }

  const supplierStillValid =
    parsed.supplier_id == null ||
    suppliers.some((s) => s.id === parsed.supplier_id)

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
      <div className="col-sm-6">
        <label className={labelClass}>{supplierLabel}</label>
        <select
          className={selectClass}
          value={
            supplierStillValid && parsed.supplier_id != null
              ? parsed.supplier_id
              : ''
          }
          onChange={(e) => handleSupplierChange(e.target.value)}
          required={required && supplierTypeId !== ''}
          disabled={supplierTypeId === '' || loadingSuppliers}
        >
          <option value="">
            {supplierTypeId === ''
              ? 'Select a supplier type first'
              : loadingSuppliers
                ? 'Loading suppliers...'
                : suppliers.length === 0
                  ? 'No suppliers available'
                  : 'Select supplier...'}
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>
      <div className="col-sm-6">
        <label className={labelClass}>{tierLabel}</label>
        <select
          className={selectClass}
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
                ? 'Loading tiers...'
                : tiers.length === 0
                  ? 'No tiers for this supplier'
                  : 'Select tier...'}
          </option>
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.name}
            </option>
          ))}
        </select>
      </div>
      {loadError && (
        <div className="col-12">
          <small className="text-danger">{loadError}</small>
        </div>
      )}
    </div>
  )
}
