import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import defaultBrandLogo from '../assets/images/logo.png'
import { useAuthSession } from '../context/AuthSessionContext'
import { fetchSecuredFileBlobUrl } from '../lib/securedFileUrl'
import { canRead, canWrite } from '../lib/featureAccess'
import { canAccessAdmin } from '../lib/adminNavAccess'
import { canAccessAnySettings } from '../lib/settingsNavAccess'
import InvitationsLabel from '../features/template-studio/components/InvitationsLabel'

const Sidebar = () => {
  const { currentUser } = useAuthSession()
  const showAdmin = canAccessAdmin(currentUser)
  const [companyLogoSrc, setCompanyLogoSrc] = useState<string | null>(null)

  const companyLogoUrl = (currentUser?.company_logo_url ?? '').trim()
  const companyName = (currentUser?.company_name ?? '').trim()
  const brandTitle = companyName || 'Planning With You'

  useEffect(() => {
    if (!companyLogoUrl) {
      setCompanyLogoSrc(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    void fetchSecuredFileBlobUrl(companyLogoUrl)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setCompanyLogoSrc(url)
      })
      .catch(() => {
        if (!cancelled) setCompanyLogoSrc(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [companyLogoUrl])

  const brandImageSrc = companyLogoSrc ?? defaultBrandLogo
  const hasCompanyLogo = Boolean(companyLogoSrc)

  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
      <div className="sidebar-brand">
        <NavLink to="/" className="brand-link">
        <img src={brandImageSrc} alt="" width={200} height={70} />
        </NavLink>
      </div>

      <div className="sidebar-wrapper">
        <nav className="mt-2">
          <ul
            className="nav sidebar-menu flex-column"
            data-lte-toggle="treeview"
            role="menu"
            data-accordion="false"
          >
            {canRead(currentUser, 'dashboard') && (
              <li className="nav-item">
                <NavLink to="/" end className={linkClassName}>
                  <i className="nav-icon bi bi-speedometer2" />
                  <p>Dashboard</p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'calendar') && (
              <li className="nav-item">
                <NavLink to="/calendar" className={linkClassName}>
                  <i className="nav-icon bi bi-calendar3" />
                  <p>Calendar</p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'bookings') && (
              <li className="nav-item">
                <NavLink to="/bookings" className={linkClassName}>
                  <i className="nav-icon bi bi-kanban" />
                  <p>Bookings</p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'contacts') && (
              <li className="nav-item">
                <NavLink to="/contacts" className={linkClassName}>
                  <i className="nav-icon bi bi-person-lines-fill" />
                  <p>Contacts</p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'users') && (
              <li className="nav-item">
                <NavLink to="/users" className={linkClassName}>
                  <i className="nav-icon bi bi-people" />
                  <p>Users</p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'emails') && (
              <li className="nav-item">
                <NavLink to="/emails" className={linkClassName}>
                  <i className="nav-icon bi bi-envelope" />
                  <p>Emails</p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'file_manager') && (
              <li className="nav-item">
                <NavLink to="/file-manager" className={linkClassName}>
                  <i className="nav-icon bi bi-folder2-open" />
                  <p>File Manager</p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'template_studio') && (
              <li className="nav-item">
                <NavLink to="/invitations" className={linkClassName}>
                  <i className="nav-icon bi bi-envelope-heart" />
                  <p>
                    <InvitationsLabel />
                  </p>
                </NavLink>
              </li>
            )}
            {canRead(currentUser, 'reports') && (
              <li className="nav-item">
                <NavLink to="/reports" className={linkClassName}>
                  <i className="nav-icon bi bi-file-earmark-text" />
                  <p>Reports</p>
                </NavLink>
              </li>
            )}
            {canAccessAnySettings(currentUser) && (
              <li className="nav-item">
                <NavLink to="/settings" className={linkClassName}>
                  <i className="nav-icon bi bi-gear" />
                  <p>Settings</p>
                </NavLink>
              </li>
            )}
            {showAdmin && (
              <li className="nav-item">
                <NavLink to="/admin" className={linkClassName}>
                  <i className="nav-icon bi bi-shield-lock" />
                  <p>Admin</p>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
