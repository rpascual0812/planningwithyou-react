import { NavLink } from 'react-router-dom'

const Sidebar = () => {
  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
      <div className="sidebar-brand">
        <NavLink to="/" className="brand-link">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" role="img">
              <rect width="32" height="32" rx="9" fill="url(#brandMarkBg)" />
              <path
                d="M8.2 22.8V8.4h6.4c3.3 0 5.3 1.8 5.3 4.7 0 2.9-2 4.7-5.3 4.7h-2.4v5H8.2Zm4-8.1h2.1c1.2 0 1.9-.6 1.9-1.6s-.7-1.6-1.9-1.6h-2.1v3.2Z"
                fill="#ffffff"
              />
              <path
                d="M19.5 22.8v-5.1l-5-9.3h4.2l2.8 5.6 2.8-5.6h3.9l-4.9 9.2v5.2h-3.8Z"
                fill="#7ed0ad"
              />
              <defs>
                <linearGradient id="brandMarkBg" x1="4" y1="4" x2="28" y2="28">
                  <stop stopColor="#2d527e" />
                  <stop offset="0.55" stopColor="#1c365a" />
                  <stop offset="1" stopColor="#081427" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span className="brand-text-wrap">
            <span className="brand-text">Planning With You</span>
            <span className="brand-subtitle">Premium Admin</span>
          </span>
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
            <li className="nav-item">
              <NavLink to="/" end className={linkClassName}>
                <i className="nav-icon bi bi-speedometer2" />
                <p>Dashboard</p>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/calendar" className={linkClassName}>
                <i className="nav-icon bi bi-calendar3" />
                <p>Calendar</p>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/bookings" className={linkClassName}>
                <i className="nav-icon bi bi-kanban" />
                <p>Bookings</p>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/users" className={linkClassName}>
                <i className="nav-icon bi bi-people" />
                <p>Users</p>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/file-manager" className={linkClassName}>
                <i className="nav-icon bi bi-folder2-open" />
                <p>File Manager</p>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/reports" className={linkClassName}>
                <i className="nav-icon bi bi-file-earmark-text" />
                <p>Reports</p>
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/settings" className={linkClassName}>
                <i className="nav-icon bi bi-gear" />
                <p>Settings</p>
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar
