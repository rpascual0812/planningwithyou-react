import { parsePhoneNumberFromString } from 'libphonenumber-js'

/** Practical email check (stricter than ``type="email"`` alone). */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function validateEmailAddress(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Email is required.'
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address.'
  }
  return null
}

/** Empty input is valid; non-empty must match ``EMAIL_PATTERN``. */
export function validateOptionalEmailAddress(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address.'
  }
  return null
}

export function validateMobileNumber(
  value: string,
  { required = true }: { required?: boolean } = {},
): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return required ? 'Mobile number is required.' : null
  }
  const parsed = parsePhoneNumberFromString(trimmed, 'PH')
  if (!parsed?.isValid()) {
    return 'Please enter a valid mobile number (e.g. +63 912 345 6789).'
  }
  return null
}

/** E.164-style international format when valid; otherwise ``null``. */
export function formatMobileNumberInternational(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parsePhoneNumberFromString(trimmed, 'PH')
  if (!parsed?.isValid()) return null
  return parsed.formatInternational()
}
