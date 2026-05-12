import { NavLink } from 'react-router-dom'

const Sidebar = () => {
  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`

  return (
    <aside className="app-sidebar bg-body-secondary shadow" data-bs-theme="dark">
      <div className="sidebar-brand">
        <NavLink to="/" className="brand-link">
          <span className="brand-text fw-light">Planning With You</span>
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
