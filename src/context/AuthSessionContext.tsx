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
  clearStoredTokens,
} from '../services/auth'
import { fetchMe, type UserRecord } from '../services/users'
import { fetchCurrentAccountSubscription } from '../services/subscriptions'
import { setActiveAppTimeZone } from '../lib/appTimezone'
import { resolveTimezoneInput } from '../lib/timezones'

type AuthSessionContextValue = {
  isAuthenticated: boolean
  currentUser: UserRecord | null
  subscriptionPlan: string | null
  userLoading: boolean
  syncAuthState: () => void
  updateCurrentUser: (user: UserRecord) => void
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

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof Error && err.name === 'AbortError') return true
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

  const loadAccountSubscription = useCallback(async () => {
    if (!hasStoredSession()) {
      setSubscriptionPlan(null)
      return
    }
    try {
      const row = await fetchCurrentAccountSubscription()
      setSubscriptionPlan(row?.plan ?? 'free')
    } catch (err) {
      if (isAbortError(err)) return
      setSubscriptionPlan('free')
    }
  }, [])

  const loadCurrentUser = useCallback(async () => {
    if (!hasStoredSession()) {
      hasLoadedUserRef.current = false
      setCurrentUser(null)
      setUserLoading(false)
      return
    }
    if (!hasLoadedUserRef.current) {
      setUserLoading(true)
    }
    try {
      const user = await fetchMe()
      setCurrentUser(user)
      setActiveAppTimeZone(
        user.company_timezone?.trim()
          ? resolveTimezoneInput(user.company_timezone)
          : undefined,
      )
      hasLoadedUserRef.current = true
    } catch (err) {
      if (isAbortError(err)) return
      hasLoadedUserRef.current = false
      setCurrentUser(null)
      setActiveAppTimeZone(undefined)
      setIsAuthenticated(false)
      clearStoredTokens()
    } finally {
      setUserLoading(false)
    }
  }, [])

  const loadSession = useCallback(async () => {
    if (!hasStoredSession()) {
      hasLoadedUserRef.current = false
      setCurrentUser(null)
      setSubscriptionPlan(null)
      setUserLoading(false)
      return
    }
    await loadCurrentUser()
    if (hasStoredSession()) {
      await loadAccountSubscription()
    }
  }, [loadAccountSubscription, loadCurrentUser])

  const syncAuthState = useCallback(() => {
    const authed = hasStoredSession()
    setIsAuthenticated(authed)
    if (authed) {
      void loadSession()
    } else {
      hasLoadedUserRef.current = false
      setCurrentUser(null)
      setSubscriptionPlan(null)
      setUserLoading(false)
    }
  }, [loadSession])

  const updateCurrentUser = useCallback((user: UserRecord) => {
    setCurrentUser(user)
    setActiveAppTimeZone(
      user.company_timezone?.trim()
        ? resolveTimezoneInput(user.company_timezone)
        : undefined,
    )
    hasLoadedUserRef.current = true
    setUserLoading(false)
    void loadAccountSubscription()
  }, [loadAccountSubscription])

  useEffect(() => {
    return startAuthSessionKeepAlive()
  }, [])

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    const refreshSubscriptionOnVisible = () => {
      if (document.visibilityState === 'visible' && hasStoredSession()) {
        void loadAccountSubscription()
      }
    }
    document.addEventListener('visibilitychange', refreshSubscriptionOnVisible)
    return () => {
      document.removeEventListener('visibilitychange', refreshSubscriptionOnVisible)
    }
  }, [loadAccountSubscription])

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
      updateCurrentUser,
    }),
    [isAuthenticated, currentUser, subscriptionPlan, userLoading, syncAuthState, updateCurrentUser],
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
