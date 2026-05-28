import type { EmailMergeVariableKey } from '../constants/emailMergeVariables'
import type { CompanyRecord } from '../services/companies'
import type { UserRecord } from '../services/users'

export type EmailMergeContext = Partial<Record<EmailMergeVariableKey | string, string>>

export function companyEmailMergeContext(
  company: CompanyRecord | null | undefined,
): EmailMergeContext {
  return {
    company_name: company?.name?.trim() ?? '',
    company_contact_person: company?.contact_person?.trim() ?? '',
    company_phone_number: company?.phone_number?.trim() ?? '',
    company_mobile_number: company?.mobile_number?.trim() ?? '',
    company_address: company?.address?.trim() ?? '',
  }
}

export function userEmailMergeContext(
  user: UserRecord | null | undefined,
): EmailMergeContext {
  const first = user?.first_name?.trim() ?? ''
  const last = user?.last_name?.trim() ?? ''
  const name = `${first} ${last}`.trim() || user?.username?.trim() || ''
  return {
    name,
    first_name: first,
    last_name: last,
    email_address: user?.email?.trim() ?? '',
    mobile_number: '',
  }
}

export function buildEmailMergeContext(options: {
  user?: UserRecord | null
  company?: CompanyRecord | null
  paymentLinkUrl?: string
  bookingId?: string | number | null
  bookingTitle?: string | null
  transactionId?: string | null
  amountPaid?: string | number | null
}): EmailMergeContext {
  const bookingId =
    options.bookingId == null ? '' : String(options.bookingId).trim()
  const amountPaid =
    options.amountPaid == null ? '' : String(options.amountPaid).trim()
  return {
    ...userEmailMergeContext(options.user),
    ...companyEmailMergeContext(options.company),
    ...(options.paymentLinkUrl?.trim()
      ? { payment_link: options.paymentLinkUrl.trim() }
      : {}),
    booking_id: bookingId,
    booking_title: options.bookingTitle?.trim() ?? '',
    transaction_id: options.transactionId?.trim() ?? '',
    amount_paid: amountPaid,
  }
}
