/**
 * Merge / placeholder variables available for email templates and editors.
 * Import `EMAIL_MERGE_VARIABLES` or `emailMergeVariableToken` anywhere in the app.
 */

export type EmailMergeVariableKey =
  | 'first_name'
  | 'last_name'
  | 'mobile_number'
  | 'email_address'
  | 'reset_url'
  | 'lifetime'

export type EmailMergeVariableDef = {
  key: EmailMergeVariableKey
  /** Human-readable label for pickers and UI */
  label: string
}

export const EMAIL_MERGE_VARIABLES: readonly EmailMergeVariableDef[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'mobile_number', label: 'Mobile number' },
  { key: 'email_address', label: 'Email address' },
  { key: 'reset_url', label: 'Reset URL' },
  { key: 'lifetime', label: 'Lifetime' },
]

/** Placeholder token inserted into HTML/text (e.g. for later replacement). */
export function emailMergeVariableToken(key: EmailMergeVariableKey | string): string {
  return `{${key}}`
}
