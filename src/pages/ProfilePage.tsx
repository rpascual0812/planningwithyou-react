type SettingsNavItem = {
  id: string
  label: string
  icon: string
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: 'profile', label: 'Profile', icon: 'bi-person-gear' },
  { id: 'activity', label: 'Activity', icon: 'bi-clock-history' },
  { id: 'security', label: 'Security', icon: 'bi-shield-check' },
  { id: 'privacy', label: 'Privacy', icon: 'bi-lock' },
  { id: 'notification', label: 'Notification', icon: 'bi-bell' },
  { id: 'subscription', label: 'Subscription', icon: 'bi-credit-card' },
  { id: 'connection', label: 'Connection', icon: 'bi-diagram-3' },
  { id: 'delete', label: 'Delete', icon: 'bi-trash' },
]

const TIME_SPENT = [52, 68, 83, 58, 72, 79, 70]
const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const ProfilePage = () => {
  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="profile-page-layout">
          <aside className="profile-settings-col">
            <section className="profile-panel">
              <h5 className="profile-panel-title">Settings</h5>
              <nav aria-label="Profile settings">
                <ul className="profile-settings-nav">
                  {SETTINGS_NAV.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`profile-settings-link${
                          item.id === 'profile' ? ' is-active' : ''
                        }`}
                      >
                        <i className={`bi ${item.icon}`} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </section>

            <section className="profile-panel profile-time-card">
              <h5 className="profile-panel-title">Time Spent</h5>
              <div className="profile-chart" aria-label="Weekly time spent">
                <div className="profile-chart-bars" aria-hidden="true">
                  {TIME_SPENT.map((height, index) => (
                    <span
                      key={`${WEEK_DAYS[index]}-${index}`}
                      className="profile-chart-bar"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                  <svg className="profile-chart-line" viewBox="0 0 220 110">
                    <polyline
                      points="0,62 36,78 72,36 108,58 144,28 180,42 220,34"
                      fill="none"
                      stroke="#e4cf5f"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="220" cy="34" r="6" fill="#ffffff" stroke="#e4cf5f" strokeWidth="3" />
                  </svg>
                </div>
                <div className="profile-chart-days">
                  {WEEK_DAYS.map((day, index) => (
                    <span key={`${day}-${index}`}>{day}</span>
                  ))}
                </div>
              </div>
            </section>
          </aside>

          <main className="profile-main-card">
            <header className="profile-main-header">
              <h5 className="profile-panel-title">Profile</h5>
            </header>

            <div className="profile-cover">
              <img
                src="https://picsum.photos/seed/profile-cover-sail/1400/360"
                alt=""
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="profile-identity">
              <div className="profile-photo-wrap">
                <img
                  className="profile-photo"
                  src="https://i.pravatar.cc/160?u=ninfa-monaldo"
                  alt="Ninfa Monaldo"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  className="profile-photo-action"
                  aria-label="Change profile photo"
                >
                  <i className="bi bi-camera" />
                </button>
              </div>
              <div className="profile-name-row">
                <h4>Ninfa Monaldo</h4>
                <i className="bi bi-patch-check-fill" aria-label="Verified" />
              </div>
              <p>Web designer &amp; Developer</p>
            </div>

            <form className="profile-form">
              <section className="profile-form-section">
                <h5>User Info</h5>
                <div className="profile-form-grid profile-form-grid--single">
                  <label className="profile-field">
                    <span>Username</span>
                    <input type="text" defaultValue="Maria C. Eck" />
                  </label>
                  <label className="profile-field">
                    <span>Email address</span>
                    <input type="email" defaultValue="MariaCEck@teleworm.us" />
                  </label>
                </div>
                <div className="profile-form-grid">
                  <label className="profile-field">
                    <span>Password</span>
                    <input type="password" defaultValue="password" />
                  </label>
                  <label className="profile-field">
                    <span>Confirm Password</span>
                    <input type="password" defaultValue="password" />
                  </label>
                </div>
              </section>

              <section className="profile-form-section">
                <h5>Personal Info</h5>
                <div className="profile-form-grid">
                  <label className="profile-field">
                    <span>First Name</span>
                    <input type="text" defaultValue="Ninfa" />
                  </label>
                  <label className="profile-field">
                    <span>Last Name</span>
                    <input type="text" defaultValue="Monaldo" />
                  </label>
                </div>
                <label className="profile-field">
                  <span>Bio</span>
                  <textarea
                    rows={4}
                    defaultValue="Focused web designer and developer building accessible interfaces for product teams."
                  />
                </label>
              </section>

              <div className="profile-form-actions">
                <button type="button" className="btn btn-outline-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
