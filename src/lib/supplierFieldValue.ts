export type SupplierFieldValue = {
  tier_id: number | null
  supplier_id: number | null
  /** Tier price from supplier settings (used in booking price summary). */
  price?: string | null
}

export function parseSupplierFieldValue(value: string): SupplierFieldValue {
  if (!value.trim()) {
    return { tier_id: null, supplier_id: null }
  }
  try {
    const parsed = JSON.parse(value) as {
      tier_id?: number | string | null
      supplier_id?: number | string | null
      price?: number | string | null
    }
    const tier_id =
      parsed.tier_id != null && parsed.tier_id !== ''
        ? Number(parsed.tier_id)
        : null
    const supplier_id =
      parsed.supplier_id != null && parsed.supplier_id !== ''
        ? Number(parsed.supplier_id)
        : null
    const priceRaw = parsed.price
    const price =
      priceRaw != null && priceRaw !== ''
        ? String(priceRaw)
        : null

    return {
      tier_id: tier_id != null && !Number.isNaN(tier_id) ? tier_id : null,
      supplier_id:
        supplier_id != null && !Number.isNaN(supplier_id) ? supplier_id : null,
      price,
    }
  } catch {
    return { tier_id: null, supplier_id: null }
  }
}

export function serializeSupplierFieldValue(value: SupplierFieldValue): string {
  if (value.tier_id == null && value.supplier_id == null) {
    return ''
  }
  const payload: Record<string, unknown> = {
    tier_id: value.tier_id,
    supplier_id: value.supplier_id,
  }
  if (value.price != null && value.price !== '') {
    payload.price = value.price
  }
  return JSON.stringify(payload)
}
