import type { BookingField } from '../components/BookingEditModal'
import { parseSupplierFieldValue } from './supplierFieldValue'

export type BookingPriceLine = {
  label: string
  amount: number
}

function parseAmount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function fieldHasValue(field: BookingField): boolean {
  switch (field.field_type) {
    case 'checkbox':
      return field.value === 'true'
    default:
      return field.value.trim().length > 0
  }
}

/** Line items from saved booking fields that have a price contribution. */
export function getBookingPriceLines(fields: BookingField[]): BookingPriceLine[] {
  const lines: BookingPriceLine[] = []

  for (const field of fields) {
    if (!field.saved || !field.label.trim()) continue

    if (field.field_type === 'select') {
      if (!field.value.trim()) continue
      const selected = field.options.find((o) => o.label === field.value)
      const amount = parseAmount(selected?.price ?? field.price)
      if (amount === null) continue
      lines.push({ label: field.label.trim(), amount })
      continue
    }

    if (field.field_type === 'supplier') {
      const { tier_id, supplier_id, price } = parseSupplierFieldValue(field.value)
      if (tier_id == null || supplier_id == null) continue
      const amount = parseAmount(price)
      if (amount === null) continue
      lines.push({ label: field.label.trim(), amount })
      continue
    }

    if (!fieldHasValue(field)) continue
    const amount = parseAmount(field.price)
    if (amount === null) continue
    lines.push({ label: field.label.trim(), amount })
  }

  return lines
}

export function sumBookingPriceLines(lines: BookingPriceLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0)
}
