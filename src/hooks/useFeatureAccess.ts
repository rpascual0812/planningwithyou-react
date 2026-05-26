import { useMemo } from 'react'
import { useAuthSession } from '../context/AuthSessionContext'
import { canRead, canWrite } from '../lib/featureAccess'

export function useFeatureAccess(feature: string) {
  const { currentUser } = useAuthSession()
  return useMemo(
    () => ({
      canRead: canRead(currentUser, feature),
      canWrite: canWrite(currentUser, feature),
    }),
    [currentUser, feature],
  )
}
