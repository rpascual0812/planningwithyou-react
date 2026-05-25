import { emailMergeVariableToken } from '../constants/emailMergeVariables'
import type { EmailMergeContext } from './emailMergeContext'

/** Replace all ``{key}`` tokens present in *context*. */
export function applyEmailMergeVariables(
  text: string,
  context: EmailMergeContext,
): string {
  let out = text
  for (const [key, value] of Object.entries(context)) {
    if (value == null) continue
    out = out.replaceAll(emailMergeVariableToken(key), String(value))
  }
  return out
}

/** Replace ``{payment_link}`` in subject/body when sending booking emails. */
export function applyPaymentLinkPlaceholder(
  text: string,
  paymentUrl: string,
): string {
  if (!paymentUrl.trim()) return text
  return applyEmailMergeVariables(text, { payment_link: paymentUrl })
}
