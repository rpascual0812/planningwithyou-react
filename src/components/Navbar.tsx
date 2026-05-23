import { Link, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../context/AuthSessionContext'
import { logout } from '../services/auth'
import type { UserRecord } from '../services/users'

type NavbarProps = {
  onToggleSidebar: () => void
}

function getInitials(user: UserRecord): string {
  const first = user.first_name?.[0] ?? ''
  const last = user.last_name?.[0] ?? ''
  if (first || last) return `${first}${last}`.toUpperCase()
  return (user.username?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
}

function getDisplayName(user: UserRecord): string {
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || user.username || user.email
}

const Navbar = ({ onToggleSidebar }: NavbarProps) => {
  const { currentUser: user } = useAuthSession()
  const navigate = useNavigate()

  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid">
        <ul className="navbar-nav">
          <li className="nav-item">
            <button
              type="button"
              className="nav-link border-0 bg-transparent"
              onClick={onToggleSidebar}
              aria-label="Toggle sidebar"
            >
              <i className="bi bi-list" />
            </button>
          </li>
          <li className="nav-item d-none d-md-block">
            <a href="#" className="nav-link">
              Dashboard
            </a>
          </li>
        </ul>

        <ul className="navbar-nav ms-auto">
          <li className="nav-item dropdown">
            <a className="nav-link" data-bs-toggle="dropdown" href="#">
              <i className="bi bi-bell-fill" />
              <span className="navbar-badge badge text-bg-warning">3</span>
            </a>
            <div className="dropdown-menu dropdown-menu-lg dropdown-menu-end">
              <span className="dropdown-item dropdown-header">3 Notifications</span>
              <div className="dropdown-divider" />
              <a href="#" className="dropdown-item">
                <i className="bi bi-envelope me-2" /> 1 new message
              </a>
              <div className="dropdown-divider" />
              <a href="#" className="dropdown-item">
                <i className="bi bi-people me-2" /> 2 new connections
              </a>
            </div>
          </li>

          <li className="nav-item dropdown nav-profile-item">
            <a
              className="nav-link nav-profile-toggle"
              data-bs-toggle="dropdown"
              href="#"
              aria-label="User menu"
              aria-expanded="false"
            >
              <span className="nav-profile-avatar">
                <span
                  className="nav-profile-avatar-fallback"
                  aria-hidden="true"
                >
                  {user ? getInitials(user) : '?'}
                </span>
              </span>
              <span className="nav-profile-name d-none d-md-inline">
                {user ? getDisplayName(user) : ''}
              </span>
              <i className="bi bi-chevron-down nav-profile-caret" aria-hidden="true" />
            </a>
            <div className="dropdown-menu dropdown-menu-end nav-profile-menu">
              <div className="dropdown-item-text nav-profile-header">
                <span
                  className="nav-profile-avatar nav-profile-avatar--lg"
                  aria-hidden="true"
                >
                  <span className="nav-profile-avatar-fallback">
                    {user ? getInitials(user) : '?'}
                  </span>
                </span>
                <div>
                  <div className="nav-profile-header-name">{user ? getDisplayName(user) : ''}</div>
                  <div className="nav-profile-header-email">{user?.email ?? ''}</div>
                </div>
              </div>
              <div className="dropdown-divider" />
              <Link to="/profile" className="dropdown-item">
                <i className="bi bi-person me-2" /> Edit Profile
              </Link>
              <Link to="/settings" className="dropdown-item">
                <i className="bi bi-gear me-2" /> Settings
              </Link>
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
