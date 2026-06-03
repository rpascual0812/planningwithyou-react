import { useEffect } from 'react'
import { setActiveAppTimeZone } from '../lib/appTimezone'
import { useCompanyTimezone } from '../hooks/useCompanyTimezone'

/** Keeps ``formatAppDateTime`` / history timestamps aligned with the active company. */
export function AppTimezoneSync({
  companyId,
  companies,
}: {
  companyId?: number | null
  companies?: { id: number; timezone: string }[]
} = {}) {
  const timeZone = useCompanyTimezone({ companyId, companies })

  useEffect(() => {
    setActiveAppTimeZone(timeZone)
  }, [timeZone])

  return null
}

export default AppTimezoneSync
