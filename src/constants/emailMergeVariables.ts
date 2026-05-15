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
  | 'reset_url'
  | 'lifetime'

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
  { key: 'reset_url', label: 'Reset URL' },
  { key: 'lifetime', label: 'Link lifetime (hours)' },
]

/** Placeholder token inserted into HTML/text (e.g. for later replacement). */
export function emailMergeVariableToken(key: EmailMergeVariableKey | string): string {
  return `{${key}}`
}
