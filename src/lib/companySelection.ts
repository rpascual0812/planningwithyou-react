import type { CompanyRecord } from '../services/companies'
import type { UserRecord } from '../services/users'
import { canRead } from './featureAccess'

export const CHANGE_COMPANY_FEATURE = 'change_company'

export function canChangeCompany(user: UserRecord | null): boolean {
  return canRead(user, CHANGE_COMPANY_FEATURE)
}

/** Default company context: user's company, else account main, else first active. */
export function pickDefaultCompanyId(
  companies: CompanyRecord[],
  userCompanyId: number | null | undefined,
): number | null {
  if (userCompanyId != null && companies.some((c) => c.id === userCompanyId)) {
    return userCompanyId
  }
  if (companies.length === 0) return null
  const main = companies.find((c) => c.is_main)
  return main?.id ?? companies[0].id
}

/** Company id used in API queries for the signed-in user. */
export function lockedCompanyId(user: UserRecord | null): number | null {
  return user?.company ?? null
}

export function activeCompanyIdForUser(
  user: UserRecord | null,
  companies: CompanyRecord[],
  selectedCompanyId: number | null,
): number | null {
  const userCompanyId = lockedCompanyId(user)
  if (!canChangeCompany(user)) {
    return userCompanyId
  }
  if (
    selectedCompanyId != null &&
    companies.some((c) => c.id === selectedCompanyId)
  ) {
    return selectedCompanyId
  }
  return pickDefaultCompanyId(companies, userCompanyId)
}

/** Resolve display name without a companies list fetch when locked to the user's company. */
export function companyNameForScope(
  companies: CompanyRecord[],
  companyId: number | null,
  user: UserRecord | null,
): string | null {
  if (companyId == null) return null
  const row = companies.find((c) => c.id === companyId)
  if (row) return row.name
  if (user?.company === companyId && user.company_name) {
    return user.company_name
  }
  return null
}

export function showCompanyFilter(
  user: UserRecord | null,
  companies: CompanyRecord[],
): boolean {
  return canChangeCompany(user) && companies.length > 1
}
