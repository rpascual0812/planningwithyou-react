import type { BookingField } from '../components/BookingEditModal'
import type { BookingFieldGroup } from './bookingFieldGroups'
import { mergeBookingFieldGroups } from './bookingFieldGroups'
import { parseSupplierFieldValue } from './supplierFieldValue'

export type BookingPriceLine = {
  label: string
  amount: number
}

export type BookingPriceGroup = {
  groupName: string
  lines: BookingPriceLine[]
  subtotal: number
}

function parseAmount(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function configuredFieldPrice(field: BookingField): string | null {
  if (field.price === null || field.price === '') return null
  return field.price
}

/** Raw price string for a field (before formatting). */
function resolveBookingFieldPriceRawInner(
  field: BookingField,
  requireSaved: boolean,
): string | null {
  if (!field.label.trim()) return null
  if (requireSaved && !field.saved) return null

  if (field.field_type === 'select') {
    if (field.value.trim()) {
      const selected = field.options.find((o) => o.label === field.value)
      const raw = selected?.price ?? field.price
      return raw === null || raw === '' ? null : raw
    }
    const optionPrices = field.options
      .map((o) => parseAmount(o.price))
      .filter((n): n is number => n !== null && n > 0)
    if (optionPrices.length > 0) {
      return String(Math.max(...optionPrices))
    }
    return configuredFieldPrice(field)
  }

  if (field.field_type === 'supplier') {
    const parsed = parseSupplierFieldValue(field.value)
    if (parsed.tier_id == null || parsed.supplier_id == null) return null
    const raw = field.price ?? parsed.price ?? null
    return raw === null || raw === '' ? null : raw
  }

  if (field.field_type === 'checkbox') {
    if (requireSaved && field.value !== 'true') return null
    return configuredFieldPrice(field)
  }

  return configuredFieldPrice(field)
}

/** Raw price for a saved field (price summary, display). */
export function resolveBookingFieldPriceRaw(
  field: BookingField,
): string | null {
  return resolveBookingFieldPriceRawInner(field, true)
}

/** Raw price while editing / validating before the field row is saved. */
export function resolveBookingFieldPriceRawForValidation(
  field: BookingField,
): string | null {
  return resolveBookingFieldPriceRawInner(field, false)
}

/** Numeric price for a saved field, or null if it does not contribute. */
export function resolveBookingFieldPriceAmount(
  field: BookingField,
): number | null {
  return parseAmount(resolveBookingFieldPriceRaw(field))
}

/** Line items from all saved booking fields that have a price contribution. */
export function getBookingPriceLines(fields: BookingField[]): BookingPriceLine[] {
  const lines: BookingPriceLine[] = []

  for (const field of fields) {
    const amount = resolveBookingFieldPriceAmount(field)
    if (amount === null) continue
    lines.push({ label: field.label.trim(), amount })
  }

  return lines
}

/** Price lines grouped by booking group (only groups with at least one priced field). */
export function getBookingPriceGroups(
  fieldGroups: BookingFieldGroup[],
): BookingPriceGroup[] {
  const groups: BookingPriceGroup[] = []

  for (const { groupName, items } of fieldGroups) {
    const lines: BookingPriceLine[] = []
    for (const { field } of items) {
      const amount = resolveBookingFieldPriceAmount(field)
      if (amount === null) continue
      lines.push({ label: field.label.trim(), amount })
    }
    if (lines.length === 0) continue
    groups.push({
      groupName,
      lines,
      subtotal: sumBookingPriceLines(lines),
    })
  }

  return groups
}

export function sumBookingPriceLines(lines: BookingPriceLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0)
}

export function sumBookingPriceGroups(groups: BookingPriceGroup[]): number {
  return groups.reduce((sum, group) => sum + group.subtotal, 0)
}

/** Grand total shown in the booking editor price summary (same logic as the modal). */
export function bookingPriceSummaryTotal(
  fields: BookingField[],
  extraGroupNames: string[] = [],
  apiGroups: { id: number; name: string }[] = [],
): number {
  const fieldGroups = mergeBookingFieldGroups(fields, extraGroupNames, apiGroups)
  return sumBookingPriceGroups(getBookingPriceGroups(fieldGroups))
}

/** Whether ``bookings.total_amount`` is set to a positive amount. */
export function bookingStoredTotalAmountHasValue(
  totalAmount: string | null | undefined,
): boolean {
  const raw = (totalAmount ?? '').trim()
  if (!raw) return false
  const n = Number(raw)
  return !Number.isNaN(n) && n > 0
}

/** Error message when downpayment fails validation, or null if valid / empty. */
export function validateBookingFieldDownpayment(
  field: BookingField,
): string | null {
  const downRaw = (field.requiredDownpayment ?? '').trim()
  if (!downRaw) return null

  const down = Number(downRaw)
  if (Number.isNaN(down) || down < 0) {
    return 'Enter a valid downpayment (0 or greater).'
  }

  const priceAmount = parseAmount(resolveBookingFieldPriceRawForValidation(field))
  if (priceAmount === null || priceAmount <= 0) {
    return 'Set a field amount before entering a downpayment.'
  }
  if (down >= priceAmount) {
    return 'Downpayment must be less than the field amount.'
  }
  return null
}

/** Error when package/tier downpayment is not less than the supplier field amount. */
export function validateBookingSupplierFieldDownpayment(
  field: BookingField,
): string | null {
  if (field.field_type !== 'supplier') return null
  const downRaw = (field.packageRequiredDownpayment ?? '').trim()
  if (!downRaw) return null
  const down = Number(downRaw)
  if (Number.isNaN(down) || down < 0) {
    return 'Enter a valid downpayment (0 or greater).'
  }
  const priceAmount = parseAmount(resolveBookingFieldPriceRawForValidation(field))
  if (priceAmount === null || priceAmount <= 0) {
    return 'Set a supplier price before applying a package downpayment.'
  }
  if (down >= priceAmount) {
    return 'Downpayment must be less than the field amount.'
  }
  return null
}

/** Sum required downpayments for saved fields (supplier packages + line amounts). */
export function bookingPriceSummaryRequiredDownpayment(
  fields: BookingField[],
): number {
  let total = 0
  for (const field of fields) {
    if (!field.saved) continue
    const raw =
      field.field_type === 'supplier'
        ? field.packageRequiredDownpayment
        : field.requiredDownpayment
    if (raw === null || raw === undefined || raw === '') continue
    const n = Number(raw)
    if (!Number.isNaN(n) && n > 0) total += n
  }
  return total
}

/** Decimal string for ``bookings.required_downpayment_amount`` API field. */
export function bookingPriceSummaryRequiredDownpaymentAmount(
  fields: BookingField[],
): string {
  return bookingPriceSummaryRequiredDownpayment(fields).toFixed(2)
}

/** Decimal string for ``bookings.total_amount`` API field. */
export function bookingPriceSummaryTotalAmount(
  fields: BookingField[],
  extraGroupNames: string[] = [],
  apiGroups: { id: number; name: string }[] = [],
): string {
  return bookingPriceSummaryTotal(fields, extraGroupNames, apiGroups).toFixed(2)
}

/** Subtotal per group name (0 when the group has no priced fields). */
export function getBookingGroupSubtotalMap(
  fieldGroups: BookingFieldGroup[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const { groupName } of fieldGroups) {
    map.set(groupName, 0)
  }
  for (const group of getBookingPriceGroups(fieldGroups)) {
    map.set(group.groupName, group.subtotal)
  }
  return map
}
