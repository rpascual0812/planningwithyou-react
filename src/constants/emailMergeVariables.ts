/**
 * Merge / placeholder variables available for email templates and editors.
 * Import `EMAIL_MERGE_VARIABLES` or `emailMergeVariableToken` anywhere in the app.
 */

export type EmailMergeVariableKey =
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'mobile_number'
  | 'email_address'
  | 'company_name'
  | 'company_contact_person'
  | 'company_phone_number'
  | 'company_mobile_number'
  | 'company_address'
  | 'reset_url'
  | 'verify_url'
  | 'lifetime'
  | 'payment_link'
  | 'booking_id'
  | 'booking_title'
  | 'transaction_id'
  | 'amount_paid'

export type EmailMergeVariableDef = {
  key: EmailMergeVariableKey
  /** Human-readable label for pickers and UI */
  label: string
}

/**
 * All merge tokens available in user email templates (TinyMCE pickers).
 * Keep keys aligned with backend substitution in
 * ``planningwithyou/template_placeholders.py`` where applicable.
 */
export const EMAIL_MERGE_VARIABLES: readonly EmailMergeVariableDef[] = [
  { key: 'name', label: 'Full name' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'mobile_number', label: 'Mobile number' },
  { key: 'email_address', label: 'Email address' },
  { key: 'company_name', label: 'Company Name' },
  { key: 'company_contact_person', label: 'Company Contact Person' },
  { key: 'company_phone_number', label: 'Company Phone Number' },
  { key: 'company_mobile_number', label: 'Company Mobile Number' },
  { key: 'company_address', label: 'Company Address' },
  { key: 'reset_url', label: 'Reset URL' },
  { key: 'verify_url', label: 'Verification URL' },
  { key: 'lifetime', label: 'Link lifetime (hours)' },
  { key: 'payment_link', label: 'Payment link' },
  { key: 'booking_id', label: 'Booking ID' },
  { key: 'booking_title', label: 'Booking title' },
  { key: 'transaction_id', label: 'Transaction ID' },
  { key: 'amount_paid', label: 'Amount paid' },
]

/** Placeholder token inserted into HTML/text (e.g. for later replacement). */
export function emailMergeVariableToken(key: EmailMergeVariableKey | string): string {
  return `{${key}}`
}
