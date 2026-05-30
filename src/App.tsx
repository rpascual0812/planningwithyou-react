import './App.css'
import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useOutletContext,
} from 'react-router-dom'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import { useAuthSession } from './context/AuthSessionContext'
import { accessFor } from './lib/featureAccess'
import { canAccessAdmin, canAccessAnyAdminTab } from './lib/adminNavAccess'
import { firstAccessiblePath } from './lib/appNavigation'
import { canAccessAnySettings } from './lib/settingsNavAccess'
import { hasStoredSession } from './services/auth'
import DashboardPage from './pages/DashboardPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/settings/SettingsPage'
import AdminPage from './pages/settings/AdminPage'
import InvitationsLabel from './features/template-studio/components/InvitationsLabel'

const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const BookingsPage = lazy(() => import('./pages/BookingsPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const EmailsPage = lazy(() => import('./pages/EmailsPage'))
const FileManagerPage = lazy(() => import('./pages/FileManagerPage'))
const TemplateStudioPage = lazy(() => import('./pages/TemplateStudioPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const ResetPasswordConfirmPage = lazy(
  () => import('./pages/ResetPasswordConfirmPage'),
)
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const PublicPayPage = lazy(() => import('./pages/PublicPayPage'))
const PublicInvitationPage = lazy(() => import('./pages/PublicInvitationPage'))
const PublicInvitationRsvpPage = lazy(() => import('./pages/PublicInvitationRsvpPage'))
const LegalDocumentPage = lazy(() => import('./pages/LegalDocumentPage'))

/** Matches AdminLTE 4's `sidebar-expand-lg` mobile breakpoint. */
const MOBILE_MEDIA_QUERY = '(max-width: 991.98px)'

function useIsMobileViewport(): boolean {
  const getMatch = () =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches

  const [isMobile, setIsMobile] = useState<boolean>(getMatch)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}

type DashboardOutletContext = {
  isSidebarCollapsed: boolean
}

function useDashboardOutletContext(): DashboardOutletContext {
  return useOutletContext<DashboardOutletContext | undefined>() ?? {
    isSidebarCollapsed: false,
  }
}

/**
 * Wraps `CalendarPage` so the dashboard layout's sidebar-collapsed state can
 * be forwarded as a prop through React Router's `<Outlet>` context.
 */
function CalendarRoute() {
  const { isSidebarCollapsed } = useDashboardOutletContext()
  return <CalendarPage isSidebarCollapsed={isSidebarCollapsed} />
}

/**
 * The dashboard chrome (sidebar + top navbar + page-title bar) that wraps all
 * normal app routes. Standalone pages (e.g. the public project page) opt out
 * of this layout by being declared as siblings of `<DashboardLayout>` in the
 * top-level `<Routes>`.
 */
function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated, userLoading, currentUser } = useAuthSession()
  if (userLoading) {
    return children
  }
  if ((isAuthenticated || hasStoredSession()) && currentUser) {
    return <Navigate to="/" replace />
  }
  return children
}

function RequireAuth() {
  const { isAuthenticated, userLoading, currentUser } = useAuthSession()
  if (!isAuthenticated && !hasStoredSession()) {
    return <Navigate to="/login" replace />
  }
  if (userLoading) {
    return (
      <div className="app-content">
        <div className="container-fluid py-3 text-muted">Loading…</div>
      </div>
    )
  }
  if (!currentUser) {
    return <Navigate to="/login" replace state={{ sessionInvalid: true }} />
  }
  return <Outlet />
}

function RequireFeature({ featureKey }: { featureKey: string }) {
  const { currentUser, userLoading } = useAuthSession()
  if (userLoading) {
    return (
      <div className="app-content">
        <div className="container-fluid py-3 text-muted">Loading…</div>
      </div>
    )
  }
  const lvl = accessFor(currentUser, featureKey)
  if (!(lvl === 'read' || lvl === 'write')) {
    return <Navigate to={firstAccessiblePath(currentUser)} replace />
  }
  return <Outlet />
}

function RequireSettings() {
  const { currentUser, userLoading } = useAuthSession()
  if (userLoading) {
    return (
      <div className="app-content">
        <div className="container-fluid py-3 text-muted">Loading…</div>
      </div>
    )
  }
  if (!canAccessAnySettings(currentUser)) {
    return <Navigate to={firstAccessiblePath(currentUser)} replace />
  }
  return <Outlet />
}

function RequireAdmin() {
  const { currentUser, userLoading } = useAuthSession()
  if (userLoading) {
    return (
      <div className="app-content">
        <div className="container-fluid py-3 text-muted">Loading…</div>
      </div>
    )
  }
  if (!canAccessAdmin(currentUser) || !canAccessAnyAdminTab(currentUser)) {
    return <Navigate to={firstAccessiblePath(currentUser)} replace />
  }
  return <Outlet />
}

/** Keeps old `/template-studio` bookmarks working after the route was renamed. */
function TemplateStudioLegacyRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={{ pathname: '/invitations', search: location.search, hash: location.hash }}
      replace
    />
  )
}

function DashboardLayout() {
  const location = useLocation()
  const isMobile = useIsMobileViewport()
  /** Desktop "icon-only" mode (applies the `sidebar-collapse` class). */
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  /** Mobile off-canvas open state (applies the `sidebar-open` class). */
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // When the viewport crosses the breakpoint, drop the state that doesn't
  // apply to the new mode so we never end up with both classes at once.
  useEffect(() => {
    if (isMobile) {
      setIsSidebarCollapsed(false)
    } else {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

  // Always auto-close the mobile drawer when the route changes – otherwise
  // tapping a nav link would leave the overlay covering the new page.
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [location.pathname])

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen((prev) => !prev)
    } else {
      setIsSidebarCollapsed((prev) => !prev)
    }
  }

  const handleCloseMobileSidebar = () => {
    setIsSidebarOpen(false)
  }

  const pageTitleByPath: Record<string, string> = {
    '/': 'Dashboard',
    '/calendar': 'Calendar',
    '/bookings': 'Bookings',
    '/contacts': 'Contacts',
    '/users': 'Users',
    '/emails': 'Emails',
    '/file-manager': 'File Manager',
    '/profile': 'Edit Profile',
    '/reports': 'Reports',
    '/settings': 'Setting',
    '/admin': 'Admin',
  }

  const profileTab = new URLSearchParams(location.search).get('tab')
  const pageTitle =
    location.pathname === '/profile' && profileTab === 'support'
      ? 'Support'
      : location.pathname === '/profile' && profileTab === 'password'
        ? 'Reset Password'
        : location.pathname === '/invitations'
        ? <InvitationsLabel />
        : pageTitleByPath[location.pathname] ?? 'Dashboard'

  const wrapperClassName = [
    'app-wrapper',
    'layout-fixed',
    'sidebar-expand-lg',
    'bg-body-tertiary',
    isSidebarCollapsed ? 'sidebar-collapse' : '',
    isSidebarOpen ? 'sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const outletContext: DashboardOutletContext = { isSidebarCollapsed }

  return (
    <div className={wrapperClassName}>
      <Navbar onToggleSidebar={handleToggleSidebar} />
      <Sidebar />

      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
          onClick={handleCloseMobileSidebar}
        />
      )}

      <main className="app-main">
        <div className="app-content-header">
          <div className="container-fluid">
            <div className="row">
              <div className="col-sm-6">
                <h3 className="mb-0">{pageTitle}</h3>
              </div>
            </div>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="app-content">
              <div className="container-fluid py-3">Loading page...</div>
            </div>
          }
        >
          <Outlet context={outletContext} />
        </Suspense>
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Authenticated app: dashboard chrome (sidebar + navbar). */}
      <Route element={<RequireAuth />}>
        <Route element={<DashboardLayout />}>
          <Route element={<RequireFeature featureKey="dashboard" />}>
            <Route path="/" element={<DashboardPage />} />
          </Route>
          <Route element={<RequireFeature featureKey="calendar" />}>
            <Route path="/calendar" element={<CalendarRoute />} />
          </Route>
          <Route element={<RequireFeature featureKey="bookings" />}>
            <Route path="/bookings" element={<BookingsPage />} />
          </Route>
          <Route element={<RequireFeature featureKey="contacts" />}>
            <Route path="/contacts" element={<ContactsPage />} />
          </Route>
          <Route element={<RequireFeature featureKey="users" />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
          <Route element={<RequireFeature featureKey="emails" />}>
            <Route path="/emails" element={<EmailsPage />} />
          </Route>
          <Route element={<RequireFeature featureKey="file_manager" />}>
            <Route path="/file-manager" element={<FileManagerPage />} />
          </Route>
          <Route element={<RequireFeature featureKey="template_studio" />}>
            <Route path="/invitations" element={<TemplateStudioPage />} />
            <Route path="/template-studio" element={<TemplateStudioLegacyRedirect />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />} />
          <Route element={<RequireFeature featureKey="reports" />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route element={<RequireSettings />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      {/* Public, chrome-less sign-in page. Declared before `/:projectId`
          so React Router's literal-segment specificity matches `/login`
          here rather than treating it as a project id. */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <Suspense
              fallback={<div className="auth-page auth-page--loading">Loading…</div>}
            >
              <LoginPage />
            </Suspense>
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthenticated>
            <Suspense
              fallback={<div className="auth-page auth-page--loading">Loading…</div>}
            >
              <RegisterPage />
            </Suspense>
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/reset-password"
        element={
          <RedirectIfAuthenticated>
            <Suspense
              fallback={<div className="auth-page auth-page--loading">Loading…</div>}
            >
              <ResetPasswordPage />
            </Suspense>
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/reset-password/:token"
        element={
          <Suspense
            fallback={<div className="auth-page auth-page--loading">Loading…</div>}
          >
            <ResetPasswordConfirmPage />
          </Suspense>
        }
      />
      <Route
        path="/verify-email/:token"
        element={
          <Suspense
            fallback={<div className="auth-page auth-page--loading">Loading…</div>}
          >
            <VerifyEmailPage />
          </Suspense>
        }
      />

      <Route
        path="/invitations/:slug/rsvp"
        element={
          <Suspense
            fallback={
              <div className="public-rsvp-page public-rsvp-page--loading">Loading…</div>
            }
          >
            <PublicInvitationRsvpPage />
          </Suspense>
        }
      />
      <Route
        path="/invitations/:slug"
        element={
          <Suspense
            fallback={
              <div className="public-invitation-page public-invitation-page--loading">Loading…</div>
            }
          >
            <PublicInvitationPage />
          </Suspense>
        }
      />
      <Route
        path="/pay/:token"
        element={
          <Suspense
            fallback={
              <div className="public-pay-page public-pay-page--loading">Loading…</div>
            }
          >
            <PublicPayPage />
          </Suspense>
        }
      />
      <Route
        path="/legal/privacy-policy"
        element={
          <Suspense
            fallback={<div className="auth-page auth-page--loading">Loading…</div>}
          >
            <LegalDocumentPage />
          </Suspense>
        }
      />
      <Route
        path="/legal/terms-and-conditions"
        element={
          <Suspense
            fallback={<div className="auth-page auth-page--loading">Loading…</div>}
          >
            <LegalDocumentPage />
          </Suspense>
        }
      />
      <Route
        path="/legal/terms-of-use"
        element={
          <Suspense
            fallback={<div className="auth-page auth-page--loading">Loading…</div>}
          >
            <LegalDocumentPage />
          </Suspense>
        }
      />

      {/* Public, chrome-less route. React Router ranks the literal app
          routes above this dynamic segment, so `/calendar`, `/bookings`,
          etc. still resolve to the dashboard. Any other single-segment
          alphanumeric path (e.g. `/12345ABC`) lands here. */}
      <Route
        path="/:projectId"
        element={
          <Suspense
            fallback={
              <div className="project-page-loading">Loading project...</div>
            }
          >
            <ProjectPage />
          </Suspense>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
