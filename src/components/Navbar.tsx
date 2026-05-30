import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../context/AuthSessionContext'
import { logout } from '../services/auth'
import { htmlToPlainText } from '../lib/emailBody'
import {
  fetchActiveSystemNotifications,
  type ActiveSystemNotification,
} from '../services/systemNotifications'
import { canAccessAdmin } from '../lib/adminNavAccess'
import { canAccessAnySettings } from '../lib/settingsNavAccess'
import { UserAvatar } from './UserAvatar'
import type { UserRecord } from '../services/users'

type NavbarProps = {
  onToggleSidebar: () => void
}

/** How long each notification stays visible before rotating to the next. */
const NOTIFICATION_ROTATE_MS = 8000

function getDisplayName(user: UserRecord): string {
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || user.username || user.email
}

const Navbar = ({ onToggleSidebar }: NavbarProps) => {
  const { currentUser: user } = useAuthSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState<ActiveSystemNotification[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const loadNotifications = useCallback(async () => {
    try {
      const rows = await fetchActiveSystemNotifications()
      setNotifications(rows)
    } catch {
      setNotifications([])
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [loadNotifications, location.pathname])

  useEffect(() => {
    setActiveIndex(0)
  }, [notifications])

  useEffect(() => {
    if (notifications.length <= 1) return
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % notifications.length)
    }, NOTIFICATION_ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [notifications])

  const safeIndex =
    notifications.length > 0 ? activeIndex % notifications.length : 0
  const currentNotification =
    notifications.length > 0 ? notifications[safeIndex] : null

  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid app-header-inner">
        <button
          type="button"
          className="app-header-toggle nav-link border-0 bg-transparent"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <i className="bi bi-list" />
        </button>

        {currentNotification && (
          <div
            className="app-header-notifications"
            role="region"
            aria-label="System notifications"
            aria-live="polite"
          >
            <div
              key={currentNotification.id}
              className="app-header-notification"
              title={htmlToPlainText(currentNotification.message)}
            >
              <i className="bi bi-megaphone-fill app-header-notification-icon" aria-hidden />
              <span className="app-header-notification-title">
                {currentNotification.title}
              </span>
              <span className="app-header-notification-sep" aria-hidden>
                —
              </span>
              <span className="app-header-notification-message">
                {htmlToPlainText(currentNotification.message)}
              </span>
              {notifications.length > 1 && (
                <span className="app-header-notification-index" aria-hidden>
                  {safeIndex + 1}/{notifications.length}
                </span>
              )}
            </div>
          </div>
        )}

        <ul className="navbar-nav app-header-actions">
          <li className="nav-item dropdown nav-profile-item">
            <a
              className="nav-link nav-profile-toggle"
              data-bs-toggle="dropdown"
              href="#"
              aria-label="User menu"
              aria-expanded="false"
              data-tour="nav-profile"
            >
              <UserAvatar
                user={user}
                wrapperClassName="nav-profile-avatar"
                initialsClassName="nav-profile-avatar-fallback"
              />
              <span className="nav-profile-name d-none d-md-inline">
                {user ? getDisplayName(user) : ''}
              </span>
              <i className="bi bi-chevron-down nav-profile-caret" aria-hidden="true" />
            </a>
            <div className="dropdown-menu dropdown-menu-end nav-profile-menu">
              <div className="dropdown-item-text nav-profile-header">
                <UserAvatar
                  user={user}
                  wrapperClassName="nav-profile-avatar nav-profile-avatar--lg"
                  initialsClassName="nav-profile-avatar-fallback"
                />
                <div>
                  <div className="nav-profile-header-name">{user ? getDisplayName(user) : ''}</div>
                  <div className="nav-profile-header-email">{user?.email ?? ''}</div>
                </div>
              </div>
              <div className="dropdown-divider" />
              <Link to="/profile" className="dropdown-item">
                <i className="bi bi-person me-2" /> Edit Profile
              </Link>
              <Link to="/profile?tab=support" className="dropdown-item" data-tour="nav-support">
                <i className="bi bi-life-preserver me-2" /> Support
              </Link>
              {canAccessAnySettings(user) && (
                <Link to="/settings" className="dropdown-item">
                  <i className="bi bi-gear me-2" /> Settings
                </Link>
              )}
              {canAccessAdmin(user) && (
                <Link to="/admin" className="dropdown-item">
                  <i className="bi bi-shield-lock me-2" /> Admin
                </Link>
              )}
              <div className="dropdown-divider" />
              <button
                type="button"
                className="dropdown-item nav-profile-logout"
                onClick={async () => {
                  await logout()
                  navigate('/login')
                }}
              >
                <i className="bi bi-box-arrow-right me-2" /> Log out
              </button>
            </div>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
