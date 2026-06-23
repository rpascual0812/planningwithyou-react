import { newElementId } from './ids'
import type { RsvpElement, RsvpField, RsvpFieldType } from '../types/schema'

export const RSVP_FIELD_TYPES: { value: RsvpFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
]

export function createRsvpField(
  partial: Partial<RsvpField> & Pick<RsvpField, 'label'>,
): RsvpField {
  return {
    id: partial.id ?? newElementId(),
    label: partial.label,
    type: partial.type ?? 'text',
    required: partial.required ?? false,
    placeholder: partial.placeholder ?? '',
    options: partial.options,
  }
}

export const DEFAULT_RSVP_FIELDS: RsvpField[] = [
  createRsvpField({
    id: 'first_name',
    label: 'First Name',
    type: 'text',
    required: true,
    placeholder: 'First name',
  }),
  createRsvpField({
    id: 'last_name',
    label: 'Last Name',
    type: 'text',
    required: true,
    placeholder: 'Last name',
  }),
  createRsvpField({
    id: 'mobile_number',
    label: 'Mobile Number',
    type: 'tel',
    required: false,
    placeholder: 'Mobile number',
  }),
  createRsvpField({
    id: 'email_address',
    label: 'Email Address',
    type: 'email',
    required: true,
    placeholder: 'Email address',
  }),
]

/** Ensure legacy RSVP widgets have a fields array. */
export function normalizeRsvpElement(el: RsvpElement): RsvpElement {
  if (Array.isArray(el.fields) && el.fields.length > 0) {
    return el
  }
  return {
    ...el,
    fields: DEFAULT_RSVP_FIELDS.map((f) => ({ ...f, id: f.id || newElementId() })),
    successMessage: el.successMessage ?? 'Thank you! Your RSVP has been received.',
  }
}

export function cloneRsvpFields(fields: RsvpField[]): RsvpField[] {
  return fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }))
}

/** Normalize stored RSVP deadline values for ``<input type="date">``. */
export function toRsvpDeadlineInputValue(value?: string): string {
  if (!value) return ''
  const datePart = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : ''
}

export function parseExpectedGuestCountInput(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return parsed
}
