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
  privacy_policy: { path: `${import.meta.env.VITE_WEBSITE_URL}/privacy-policy`, title: 'Privacy Policy' },
  terms_condition: {
    path: `${import.meta.env.VITE_WEBSITE_URL}/terms-and-conditions`,
    title: 'Terms & Conditions',
  },
  terms_use: { path: `${import.meta.env.VITE_WEBSITE_URL}/terms-of-use`, title: 'Terms of Use' },
}

export const LEGAL_NAME_BY_PATH: Record<string, LegalDocumentName> = {
  [LEGAL_DOCUMENT_ROUTES.privacy_policy.path]: 'privacy_policy',
  [LEGAL_DOCUMENT_ROUTES.terms_condition.path]: 'terms_condition',
  [LEGAL_DOCUMENT_ROUTES.terms_use.path]: 'terms_use',
}
