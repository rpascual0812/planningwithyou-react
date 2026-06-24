export type SupplierFieldValue = {
  package_id: number | null
  supplier_id: number | null
  /** Package price from supplier settings (used in booking price summary). */
  price?: string | null
}

export function parseSupplierFieldValue(value: string): SupplierFieldValue {
  if (!value.trim()) {
    return { package_id: null, supplier_id: null }
  }
  try {
    const parsed = JSON.parse(value) as {
      package_id?: number | string | null
      tier_id?: number | string | null
      supplier_id?: number | string | null
      price?: number | string | null
    }
    const rawPackageId = parsed.package_id ?? parsed.tier_id
    const package_id =
      rawPackageId != null && rawPackageId !== ''
        ? Number(rawPackageId)
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
      package_id: package_id != null && !Number.isNaN(package_id) ? package_id : null,
      supplier_id:
        supplier_id != null && !Number.isNaN(supplier_id) ? supplier_id : null,
      price,
    }
  } catch {
    return { package_id: null, supplier_id: null }
  }
}

/** JSON stored in ``quotation_items.value`` (price lives on ``quotation_items.price``). */
export function serializeSupplierFieldValue(value: SupplierFieldValue): string {
  if (value.package_id == null && value.supplier_id == null) {
    return ''
  }
  return JSON.stringify({
    package_id: value.package_id,
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
      package_id: parsed.package_id,
      supplier_id: parsed.supplier_id,
    }),
    price,
  }
}
