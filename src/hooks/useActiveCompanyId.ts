import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { useAuthSession } from '../context/AuthSessionContext'
import {
  activeCompanyIdForUser,
  canChangeCompany,
  lockedCompanyId,
  pickDefaultCompanyId,
} from '../lib/companySelection'
import type { CompanyRecord } from '../services/companies'

/**
 * Keeps selected company in sync with Change Company permission.
 * Without permission, selection is locked to the signed-in user's company.
 */
export function useActiveCompanyId(
  companies: CompanyRecord[],
  selectedCompanyId: number | null,
  setSelectedCompanyId: Dispatch<SetStateAction<number | null>>,
) {
  const { currentUser } = useAuthSession()
  const userCompanyId = lockedCompanyId(currentUser)
  const canChange = canChangeCompany(currentUser)

  useEffect(() => {
    if (!canChange) {
      setSelectedCompanyId(userCompanyId)
      return
    }
    if (companies.length === 0) return

    setSelectedCompanyId((prev) => {
      if (prev != null && companies.some((c) => c.id === prev)) return prev
      return pickDefaultCompanyId(companies, userCompanyId)
    })
  }, [companies, canChange, userCompanyId, setSelectedCompanyId])

  const activeCompanyId = canChange
    ? activeCompanyIdForUser(currentUser, companies, selectedCompanyId)
    : userCompanyId

  return {
    activeCompanyId,
    canChangeCompany: canChange,
  }
}
