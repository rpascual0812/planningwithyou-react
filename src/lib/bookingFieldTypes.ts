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
  /** Per-line downpayment (non-supplier fields); stored on ``quotation_items``. */
  requiredDownpayment?: string | null
  sort_order: number
  /** Supplier category for ``supplier`` field definitions. */
  supplier_type_id?: number | null
  saved: boolean
  value: string
  /** From active package ``required_downpayment_amount`` (supplier fields). */
  packageRequiredDownpayment?: string | null
}
