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

/** JSON stored in ``booking_items.value`` (price lives on ``booking_items.price``). */
export function serializeSupplierFieldValue(value: SupplierFieldValue): string {
  if (value.tier_id == null && value.supplier_id == null) {
    return ''
  }
  return JSON.stringify({
    tier_id: value.tier_id,
    supplier_id: value.supplier_id,
  })
}

/** Normalize supplier line for API save / load (price column + value without price). */
export function supplierFieldForStorage(
  value: string,
  linePrice: string | null | undefined,
): { value: string; price: string | null } {
  const parsed = parseSupplierFieldValue(value)
  const price =
    linePrice != null && linePrice !== ''
      ? linePrice
      : parsed.price != null && parsed.price !== ''
        ? parsed.price
        : null
  return {
    value: serializeSupplierFieldValue({
      tier_id: parsed.tier_id,
      supplier_id: parsed.supplier_id,
    }),
    price,
  }
}
