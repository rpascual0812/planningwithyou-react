import { apiFetch, buildApiUrl } from './api'
import type { LegalDocumentName } from './adminSystemLegal'

export type PublicLegalRecord = {
  id: number | null
  name: LegalDocumentName
  value: string
}

export async function fetchPublicSystemLegal(
  name: LegalDocumentName,
): Promise<PublicLegalRecord> {
  const res = await apiFetch(buildApiUrl(`/system-legal/${name}/`))
  if (!res.ok) throw new Error('Failed to load document')
  return res.json()
}

export const LEGAL_DOCUMENT_ROUTES: Record<
  LegalDocumentName,
  { path: string; title: string }
> = {
  privacy_policy: { path: '/legal/privacy-policy', title: 'Privacy Policy' },
  terms_condition: {
    path: '/legal/terms-and-conditions',
    title: 'Terms & Conditions',
  },
  terms_use: { path: '/legal/terms-of-use', title: 'Terms of Use' },
}

export const LEGAL_NAME_BY_PATH: Record<string, LegalDocumentName> = {
  '/legal/privacy-policy': 'privacy_policy',
  '/legal/terms-and-conditions': 'terms_condition',
  '/legal/terms-of-use': 'terms_use',
}
