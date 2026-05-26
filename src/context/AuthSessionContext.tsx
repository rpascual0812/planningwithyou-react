import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  hasStoredSession,
  startAuthSessionKeepAlive,
  subscribeToAuthSync,
} from '../services/auth'
import { fetchMe, type UserRecord } from '../services/users'

type AuthSessionContextValue = {
  isAuthenticated: boolean
  currentUser: UserRecord | null
  subscriptionPlan: string | null
  userLoading: boolean
  syncAuthState: () => void
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

const PUBLIC_AUTH_PATHS = new Set([
  '/login',
  '/register',
  '/reset-password',
])

function isPublicAuthPath(pathname: string): boolean {
  if (PUBLIC_AUTH_PATHS.has(pathname)) return true
  if (pathname.startsWith('/reset-password/')) return true
  if (pathname.startsWith('/verify-email/')) return true
  return false
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredSession)
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null)
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null)
  const [userLoading, setUserLoading] = useState(hasStoredSession)
  const hasLoadedUserRef = useRef(false)

  const loadCurrentUser = useCallback(async () => {
    if (!hasStoredSession()) {
      hasLoadedUserRef.current = false
      setCurrentUser(null)
      setSubscriptionPlan(null)
      setUserLoading(false)
      return
    }
    if (!hasLoadedUserRef.current) {
      setUserLoading(true)
    }
    try {
      const user = await fetchMe()
      setCurrentUser(user)
      setSubscriptionPlan(user.subscription_plan ?? 'free')
      hasLoadedUserRef.current = true
    } catch {
      hasLoadedUserRef.current = false
      setCurrentUser(null)
      setSubscriptionPlan(null)
    } finally {
      setUserLoading(false)
    }
  }, [])

  const syncAuthState = useCallback(() => {
    const authed = hasStoredSession()
    setIsAuthenticated(authed)
    if (authed) {
      void loadCurrentUser()
    } else {
      hasLoadedUserRef.current = false
      setCurrentUser(null)
      setSubscriptionPlan(null)
      setUserLoading(false)
    }
  }, [loadCurrentUser])

  useEffect(() => {
    return startAuthSessionKeepAlive()
  }, [])

  useEffect(() => {
    void loadCurrentUser()
  }, [loadCurrentUser])

  useEffect(() => {
    const syncFromStorage = () => {
      syncAuthState()
    }

    return subscribeToAuthSync({
      onLogin: syncFromStorage,
      onLogout: () => {
        hasLoadedUserRef.current = false
        setIsAuthenticated(false)
        setCurrentUser(null)
        setSubscriptionPlan(null)
        setUserLoading(false)
        if (!isPublicAuthPath(location.pathname)) {
          navigate('/login', { replace: true })
        }
      },
      onTokensUpdated: syncFromStorage,
    })
  }, [location.pathname, navigate, syncAuthState])

  const value = useMemo(
    () => ({
      isAuthenticated,
      currentUser,
      subscriptionPlan,
      userLoading,
      syncAuthState,
    }),
    [isAuthenticated, currentUser, subscriptionPlan, userLoading, syncAuthState],
  )

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  )
}

export function useAuthSession(): AuthSessionContextValue {
  const ctx = useContext(AuthSessionContext)
  if (!ctx) {
    throw new Error('useAuthSession must be used within AuthSessionProvider')
  }
  return ctx
}
