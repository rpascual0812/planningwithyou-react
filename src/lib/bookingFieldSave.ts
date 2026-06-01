import type { BookingField } from './bookingFieldTypes'
import {
  validateBookingFieldDownpayment,
  validateBookingSupplierFieldDownpayment,
} from './bookingPriceSummary'

/** Validation message when a draft field definition cannot be saved. */
export function bookingFieldDefinitionError(field: BookingField): string | null {
  if (!field.label.trim()) {
    return 'Enter a field label before saving.'
  }
  if (
    field.field_type === 'select' &&
    field.options.filter((o) => o.label.trim()).length < 1
  ) {
    return 'Add at least one option for dropdown fields.'
  }
  const downpaymentError =
    field.field_type === 'supplier'
      ? validateBookingSupplierFieldDownpayment(field)
      : validateBookingFieldDownpayment(field)
  return downpaymentError
}

/** Mark valid draft definitions as saved; returns null if any draft is invalid. */
export function finalizeBookingFieldDefinitions(
  fields: BookingField[],
): { fields: BookingField[]; error: string | null } {
  const next = fields.map((f) => ({ ...f }))
  for (let i = 0; i < next.length; i++) {
    if (next[i].saved) continue
    const err = bookingFieldDefinitionError(next[i])
    if (err) {
      const label = next[i].label.trim() || 'Untitled field'
      return {
        fields,
        error: `${label}: ${err}`,
      }
    }
    next[i] = { ...next[i], saved: true }
  }
  return { fields: next, error: null }
}
