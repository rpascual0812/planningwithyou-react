import { useEffect, useState } from 'react'
import { useAuthSession } from '../context/AuthSessionContext'
import {
  activeCompanyIdForUser,
  canChangeCompany,
  lockedCompanyId,
  pickDefaultCompanyId,
} from '../lib/companySelection'
import { fetchActiveCompanies, type CompanyRecord } from '../services/companies'

type UseCompanyFilterOptions = {
  /** When false, skips the companies list request (defaults to Change Company permission). */
  fetchCompanies?: boolean
  onFetchError?: (message: string) => void
}

/**
 * Company filter state for pages that scope data by company.
 * Without Change Company permission, skips fetching companies and uses the user's company id.
 */
export function useCompanyFilter(options?: UseCompanyFilterOptions) {
  const { currentUser, userLoading } = useAuthSession()
  const canChange = canChangeCompany(currentUser)
  const userCompanyId = lockedCompanyId(currentUser)
  const shouldFetch = options?.fetchCompanies ?? canChange

  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(shouldFetch)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  useEffect(() => {
    if (userLoading) return

    if (!shouldFetch) {
      setCompanies([])
      setCompaniesLoading(false)
      setSelectedCompanyId(userCompanyId)
      return
    }

    let cancelled = false
    setCompaniesLoading(true)
    void fetchActiveCompanies()
      .then((rows) => {
        if (cancelled) return
        setCompanies(rows)
        setSelectedCompanyId((prev) => {
          if (prev != null && rows.some((c) => c.id === prev)) return prev
          return pickDefaultCompanyId(rows, userCompanyId)
        })
      })
      .catch((e) => {
        if (!cancelled) {
          options?.onFetchError?.(
            e instanceof Error ? e.message : 'Failed to load companies',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setCompaniesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [shouldFetch, userCompanyId, userLoading, options?.onFetchError])

  const activeCompanyId = canChange
    ? activeCompanyIdForUser(currentUser, companies, selectedCompanyId)
    : userCompanyId

  return {
    companies,
    companiesLoading: userLoading || companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
    canChangeCompany: canChange,
  }
}
