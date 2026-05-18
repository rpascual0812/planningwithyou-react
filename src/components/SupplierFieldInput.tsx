import { useEffect, useMemo, useState } from 'react'
import {
  parseSupplierFieldValue,
  serializeSupplierFieldValue,
  type SupplierFieldValue,
} from '../lib/supplierFieldValue'
import { fetchCurrentAccount } from '../services/accounts'
import {
  fetchSupplierOptions,
  fetchTiersForSupplier,
  type SupplierOptionRecord,
  type SupplierTierOptionRecord,
} from '../services/supplierField'
import {
  formatCurrency,
  localeFromIso2,
  type CurrencyFormatOptions,
} from '../utils/currency'

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
  const [suppliers, setSuppliers] = useState<SupplierOptionRecord[]>([])
  const [tiers, setTiers] = useState<SupplierTierOptionRecord[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [loadingTiers, setLoadingTiers] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyFormatOptions>({
    currencyCode: 'USD',
    locale: 'en-US',
  })

  useEffect(() => {
    let cancelled = false
    fetchCurrentAccount()
      .then((account) => {
        if (cancelled) return
        setCurrencyOptions({
          currencyCode: account.country_currency_code || 'USD',
          locale: localeFromIso2(account.country_iso2_code),
        })
      })
      .catch(() => {
        // Keep USD fallback.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingSuppliers(true)
    setLoadError('')
    fetchSupplierOptions()
      .then((data) => {
        if (!cancelled) {
          setSuppliers(data)
          if (data.length === 0) {
            setLoadError(
              'No suppliers are linked to your account. Configure suppliers in Supplier Settings.',
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
  }, [])

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
            setLoadError('No tiers are configured for this supplier.')
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
    onChange(serializeSupplierFieldValue(next))
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

  const selectedTier = useMemo(() => {
    if (parsed.tier_id == null || !tierStillValid) return null
    return tiers.find((t) => t.id === parsed.tier_id) ?? null
  }, [parsed.tier_id, tierStillValid, tiers])

  const formatTierPrice = (price: string | null): string => {
    if (price === null || price === '') return '—'
    const amount = Number(price)
    if (Number.isNaN(amount)) return price
    return formatCurrency(amount, currencyOptions)
  }

  return (
    <div className="row g-2">
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
          required={required}
          disabled={loadingSuppliers}
        >
          <option value="">
            {loadingSuppliers
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
        {selectedTier && (
          <p className="mb-0 mt-1 small text-muted">
            Price:{' '}
            <span className="fw-semibold text-body">
              {formatTierPrice(selectedTier.price)}
            </span>
          </p>
        )}
      </div>
      {loadError && (
        <div className="col-12">
          <small className="text-danger">{loadError}</small>
        </div>
      )}
    </div>
  )
}
