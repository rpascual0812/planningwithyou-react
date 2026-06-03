import { validateOptionalEmailAddress } from './formValidators'

export type EmailRecipientField = 'to' | 'cc' | 'bcc'

export type EmailRecipientsValue = {
  to: string[]
  cc: string[]
  bcc: string[]
}

/** CC/BCC only (email template settings). */
export type EmailCcBccValue = Pick<EmailRecipientsValue, 'cc' | 'bcc'>

export const EMPTY_EMAIL_RECIPIENTS: EmailRecipientsValue = {
  to: [],
  cc: [],
  bcc: [],
}

export function normalizeEmailList(emails: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of emails) {
    const addr = raw.trim()
    if (!addr) continue
    const key = addr.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(addr)
  }
  return out
}

export function tokenizeRecipientDraft(draft: string): string[] {
  return draft
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function validateRecipientTokens(tokens: string[]): string | null {
  for (const token of tokens) {
    const err = validateOptionalEmailAddress(token)
    if (err) return err
  }
  return null
}

export function moveRecipientBetweenLists(
  value: EmailRecipientsValue,
  email: string,
  from: EmailRecipientField,
  to: EmailRecipientField,
): EmailRecipientsValue {
  if (from === to) return value
  const key = email.trim().toLowerCase()
  if (!key) return value
  const fromList = value[from].filter((e) => e.toLowerCase() !== key)
  const toList = value[to].some((e) => e.toLowerCase() === key)
    ? value[to]
    : [...value[to], email.trim()]
  return {
    ...value,
    [from]: fromList,
    [to]: normalizeEmailList(toList),
  }
}
