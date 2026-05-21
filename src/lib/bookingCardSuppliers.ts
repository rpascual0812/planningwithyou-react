import type { BookingFieldValueRecord } from '../services/bookings'
import { parseSupplierFieldValue } from './supplierFieldValue'

export type BookingCardSupplier = {
  supplierId: number
  logoUrl: string
}

/** Distinct suppliers from booking line rows (``booking_items``). */
export function bookingCardSuppliersFromFieldValues(
  fieldValues: BookingFieldValueRecord[] | undefined,
): BookingCardSupplier[] {
  const seen = new Set<number>()
  const suppliers: BookingCardSupplier[] = []

  for (const line of fieldValues ?? []) {
    if (line.field_type !== 'supplier') continue

    let supplierId: number | null = null
    if (line.company != null) {
      const fromColumn = Number(line.company)
      if (!Number.isNaN(fromColumn)) supplierId = fromColumn
    }
    if (supplierId == null) {
      supplierId = parseSupplierFieldValue(line.value).supplier_id
    }
    if (supplierId == null || seen.has(supplierId)) continue

    seen.add(supplierId)
    suppliers.push({
      supplierId,
      logoUrl: (line.company_logo_url ?? '').trim(),
    })
  }

  return suppliers
}
