import { useMemo } from 'react'
import { useAuthSession } from '../context/AuthSessionContext'
import { useCompanyFilter } from './useCompanyFilter'
import { resolveTimezoneInput } from '../lib/timezones'

type CompanyTimezoneSource = {
  id: number
  timezone: string
}

type UseCompanyTimezoneOptions = {
  companyId?: number | null
  /** When omitted, uses companies from ``useCompanyFilter`` when loaded on the page. */
  companies?: CompanyTimezoneSource[]
}

/**
 * Effective IANA timezone for the active company (filter, user company, or UTC).
 */
export function useCompanyTimezone(options?: UseCompanyTimezoneOptions): string {
  const { currentUser } = useAuthSession()
  const { companies: filterCompanies, activeCompanyId } = useCompanyFilter({
    fetchCompanies: options?.companies == null,
  })
  const companies = options?.companies ?? filterCompanies

  return useMemo(() => {
    const companyId =
      options?.companyId ?? activeCompanyId ?? currentUser?.company ?? null
    if (companyId != null) {
      const fromList = companies.find((c) => c.id === companyId)?.timezone
      if (fromList?.trim()) return resolveTimezoneInput(fromList)
    }
    const fromUser = currentUser?.company_timezone?.trim()
    if (fromUser) return resolveTimezoneInput(fromUser)
    return 'UTC'
  }, [
    options?.companyId,
    activeCompanyId,
    currentUser?.company,
    currentUser?.company_timezone,
    companies,
  ])
}
