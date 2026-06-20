import { apiFetch, authHeaders, buildApiUrl } from './api'

export type AiAssistantStatus = {
  configured: boolean
  plan_eligible: boolean
  available: boolean
  plans: string[]
}

export type QuotationAiSummary = {
  summary: string
  highlights: string[]
}

export type QuotationAiEmailDraft = {
  subject: string
  body_html: string
}

async function aiApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = (await res.json()) as { detail?: string }
    return new Error(body.detail?.trim() || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function fetchAiAssistantStatus(): Promise<AiAssistantStatus> {
  const res = await apiFetch(buildApiUrl('/ai/assistant/status/'), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load AI assistant status')
  return res.json()
}

export async function summarizeQuotationWithAi(
  quotationId: number,
  prompt = '',
): Promise<QuotationAiSummary> {
  const res = await apiFetch(
    buildApiUrl(`/ai/quotations/${quotationId}/summarize/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prompt }),
    },
  )
  if (!res.ok) throw await aiApiError(res, 'Could not generate summary')
  return res.json()
}

export async function draftQuotationEmailWithAi(
  quotationId: number,
  prompt = '',
): Promise<QuotationAiEmailDraft> {
  const res = await apiFetch(
    buildApiUrl(`/ai/quotations/${quotationId}/draft-email/`),
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prompt }),
    },
  )
  if (!res.ok) throw await aiApiError(res, 'Could not draft email')
  return res.json()
}
