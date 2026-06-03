import type { FieldType } from '../services/formTemplates'

export type BookingFieldOption = {
  label: string
  price: string | null
  sort_order: number
}

export type BookingField = {
  label: string
  group_name: string
  quotation_group_id?: number | null
  field_type: FieldType
  is_required: boolean
  options: BookingFieldOption[]
  price: string | null
  /** Per-line downpayment (non-supplier fields); stored on ``booking_items``. */
  requiredDownpayment?: string | null
  sort_order: number
  saved: boolean
  value: string
  /** From active package ``required_downpayment_amount`` (supplier fields). */
  packageRequiredDownpayment?: string | null
}
