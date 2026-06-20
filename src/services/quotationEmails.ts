import { apiFetch, authHeaders, buildApiUrl } from './api'
import type { EmailRecord } from './emails'

export async function fetchQuotationEmailLogs(
  quotationId: number,
): Promise<EmailRecord[]> {
  const res = await apiFetch(
    buildApiUrl(`/quotation-items/${quotationId}/emails/`),
    { headers: authHeaders() },
  )
  if (!res.ok) throw new Error('Failed to load quotation email logs')
  return res.json()
}
