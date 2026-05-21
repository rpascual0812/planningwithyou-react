import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type {
  Address,
  ContactPayload,
  ContactRecord,
  PhoneNumber,
} from '../services/contacts'

export const EMPTY_PHONE: PhoneNumber = {
  number: '',
  label: 'mobile',
  is_default: true,
}

export const EMPTY_ADDRESS: Address = {
  label: 'home',
  street: '',
  city: '',
  state: '',
  zip_code: '',
  country: '',
  is_default: true,
}

const DEFAULT_PHONE_NUMBERS: PhoneNumber[] = [{ ...EMPTY_PHONE }]
const DEFAULT_ADDRESSES: Address[] = [{ ...EMPTY_ADDRESS }]

export const EMPTY_CONTACT_FORM: ContactPayload = {
  first_name: '',
  last_name: '',
  email: '',
  company: '',
  company_id: null,
  notes: '',
  phone_numbers: DEFAULT_PHONE_NUMBERS.map((p) => ({ ...p })),
  addresses: DEFAULT_ADDRESSES.map((a) => ({ ...a })),
}

export function ensureSingleDefault<T extends { is_default: boolean }>(
  items: T[],
): T[] {
  if (items.length === 0) return items
  const chosen = items.findIndex((item) => item.is_default)
  const index = chosen >= 0 ? chosen : 0
  return items.map((item, i) => ({ ...item, is_default: i === index }))
}

/** Keep the form's chosen default when empty phone rows are omitted on save. */
export function buildPhoneNumbersForSave(phones: PhoneNumber[]): PhoneNumber[] {
  const defaultFormIndex = phones.findIndex((p) => p.is_default)
  const saved: { formIndex: number; phone: PhoneNumber }[] = []

  for (let formIndex = 0; formIndex < phones.length; formIndex += 1) {
    const phone = phones[formIndex]
    if (!phone.number.trim()) continue

    const parsed = parsePhoneNumberFromString(phone.number, 'PH')
    if (!parsed?.isValid()) continue

    saved.push({
      formIndex,
      phone: {
        ...phone,
        number: parsed.formatInternational(),
        is_default: false,
      },
    })
  }

  if (saved.length === 0) return []

  const defaultSavedIndex = saved.findIndex(
    (row) => row.formIndex === defaultFormIndex,
  )
  const chosen = defaultSavedIndex >= 0 ? defaultSavedIndex : 0

  return saved.map((row, i) => ({
    ...row.phone,
    is_default: i === chosen,
  }))
}

export function formFromContact(c: ContactRecord): ContactPayload {
  return {
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    company: c.company,
    company_id: c.company_id,
    notes: c.notes,
    phone_numbers: ensureSingleDefault(
      c.phone_numbers.length > 0
        ? c.phone_numbers.map((p) => ({
            number: p.number,
            label: p.label,
            is_default: !!p.is_default,
          }))
        : DEFAULT_PHONE_NUMBERS.map((p) => ({ ...p })),
    ),
    addresses: ensureSingleDefault(
      c.addresses.length > 0
        ? c.addresses.map((a) => ({
            label: a.label,
            street: a.street,
            city: a.city,
            state: a.state,
            zip_code: a.zip_code,
            country: a.country,
            is_default: !!a.is_default,
          }))
        : DEFAULT_ADDRESSES.map((a) => ({ ...a })),
    ),
  }
}

export function validateContactPayload(
  form: ContactPayload,
): { ok: true; payload: ContactPayload } | { ok: false; error: string } {
  const invalid: string[] = []
  for (const phone of form.phone_numbers) {
    if (!phone.number.trim()) continue
    const parsed = parsePhoneNumberFromString(phone.number, 'PH')
    if (!parsed?.isValid()) {
      invalid.push(phone.number)
    }
  }
  if (invalid.length) {
    return {
      ok: false,
      error:
        `Invalid phone number${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}. ` +
        'Please use a valid format (e.g. +63 912 345 6789).',
    }
  }

  if (form.company_id == null) {
    return { ok: false, error: 'Company is required.' }
  }

  return {
    ok: true,
    payload: {
      ...form,
      company_id: form.company_id,
      phone_numbers: buildPhoneNumbersForSave(form.phone_numbers),
      addresses: ensureSingleDefault(form.addresses.map((a) => ({ ...a }))),
    },
  }
}
