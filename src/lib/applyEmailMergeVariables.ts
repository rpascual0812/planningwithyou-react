import { emailMergeVariableToken } from '../constants/emailMergeVariables'

/** Replace ``{payment_link}`` in subject/body when sending booking emails. */
export function applyPaymentLinkPlaceholder(
  text: string,
  paymentUrl: string,
): string {
  if (!paymentUrl.trim()) return text
  return text.replaceAll(emailMergeVariableToken('payment_link'), paymentUrl)
}
