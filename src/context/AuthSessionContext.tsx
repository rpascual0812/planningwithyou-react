import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  hasStoredSession,
  startAuthSessionKeepAlive,
  subscribeToAuthSync,
} from '../services/auth'

type AuthSessionContextValue = {
  isAuthenticated: boolean
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
  return pathname.startsWith('/reset-password/')
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredSession)

  const syncAuthState = useCallback(() => {
    setIsAuthenticated(hasStoredSession())
  }, [])

  useEffect(() => {
    return startAuthSessionKeepAlive()
  }, [])

  useEffect(() => {
    const syncFromStorage = () => {
      setIsAuthenticated(hasStoredSession())
    }

    return subscribeToAuthSync({
      onLogin: syncFromStorage,
      onLogout: () => {
        setIsAuthenticated(false)
        if (!isPublicAuthPath(location.pathname)) {
          navigate('/login', { replace: true })
        }
      },
      onTokensUpdated: syncFromStorage,
    })
  }, [location.pathname, navigate])

  const value = useMemo(
    () => ({ isAuthenticated, syncAuthState }),
    [isAuthenticated, syncAuthState],
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
