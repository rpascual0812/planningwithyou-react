import { useEffect, useState } from 'react'
import {
  parseSupplierFieldValue,
  serializeSupplierFieldValue,
  type SupplierFieldValue,
} from '../lib/supplierFieldValue'
import {
  fetchSupplierOptions,
  fetchTiers,
  type SupplierOptionRecord,
  type TierRecord,
} from '../services/supplierField'

type SupplierFieldInputProps = {
  value: string
  onChange: (value: string) => void
  required?: boolean
  tierLabel?: string
  supplierLabel?: string
  size?: 'sm' | 'default'
}

export default function SupplierFieldInput({
  value,
  onChange,
  required = false,
  tierLabel = 'Tier',
  supplierLabel = 'Supplier',
  size = 'default',
}: SupplierFieldInputProps) {
  const selectClass =
    size === 'sm' ? 'form-select form-select-sm' : 'form-select'
  const labelClass = size === 'sm' ? 'form-label small mb-1' : 'form-label'

  const parsed = parseSupplierFieldValue(value)
  const [tiers, setTiers] = useState<TierRecord[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOptionRecord[]>([])
  const [loadingTiers, setLoadingTiers] = useState(true)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadingTiers(true)
    fetchTiers()
      .then((data) => {
        if (!cancelled) setTiers(data)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load tiers.')
      })
      .finally(() => {
        if (!cancelled) setLoadingTiers(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (parsed.tier_id == null) {
      setSuppliers([])
      return
    }
    let cancelled = false
    setLoadingSuppliers(true)
    setLoadError('')
    fetchSupplierOptions(parsed.tier_id)
      .then((data) => {
        if (!cancelled) setSuppliers(data)
      })
      .catch(() => {
        if (!cancelled) {
          setSuppliers([])
          setLoadError('Could not load suppliers for this tier.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSuppliers(false)
      })
    return () => {
      cancelled = true
    }
  }, [parsed.tier_id])

  const emit = (next: SupplierFieldValue) => {
    onChange(serializeSupplierFieldValue(next))
  }

  const handleTierChange = (tierId: string) => {
    const tier_id = tierId === '' ? null : Number(tierId)
    emit({ tier_id, supplier_id: null })
  }

  const handleSupplierChange = (supplierId: string) => {
    const supplier_id = supplierId === '' ? null : Number(supplierId)
    emit({ tier_id: parsed.tier_id, supplier_id })
  }

  const supplierStillValid =
    parsed.supplier_id == null ||
    suppliers.some((s) => s.id === parsed.supplier_id)

  return (
    <div className="row g-2">
      <div className="col-sm-6">
        <label className={labelClass}>{tierLabel}</label>
        <select
          className={selectClass}
          value={parsed.tier_id ?? ''}
          onChange={(e) => handleTierChange(e.target.value)}
          required={required}
          disabled={loadingTiers}
        >
          <option value="">
            {loadingTiers ? 'Loading tiers...' : 'Select tier...'}
          </option>
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.name}
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
          required={required && parsed.tier_id != null}
          disabled={
            parsed.tier_id == null || loadingSuppliers || suppliers.length === 0
          }
        >
          <option value="">
            {parsed.tier_id == null
              ? 'Select a tier first'
              : loadingSuppliers
                ? 'Loading suppliers...'
                : suppliers.length === 0
                  ? 'No suppliers for this tier'
                  : 'Select supplier...'}
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
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
