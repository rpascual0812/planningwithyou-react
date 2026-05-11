type NavbarProps = {
  onToggleSidebar: () => void
}

const Navbar = ({ onToggleSidebar }: NavbarProps) => {
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
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
