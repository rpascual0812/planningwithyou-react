import { useEffect, useState } from 'react'
import { fetchMe, updateUser, type UserRecord } from '../services/users'

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

const ProfilePage = () => {
  const [user, setUser] = useState<UserRecord | null>(null)
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  useEffect(() => {
    fetchMe()
      .then((u) => {
        setUser(u)
        setForm({
          username: u.username,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
        })
      })
      .catch(() => {})
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage(null)
    try {
      const updated = await updateUser(user.id, form)
      setUser(updated)
      setMessage({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      setMessage({ type: 'danger', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

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
                <span className="profile-photo profile-photo-initials">
                  {user ? getInitials(user) : '?'}
                </span>
                <button
                  type="button"
                  className="profile-photo-action"
                  aria-label="Change profile photo"
                >
                  <i className="bi bi-camera" />
                </button>
              </div>
              <div className="profile-name-row">
                <h4>{user ? getDisplayName(user) : ''}</h4>
                {user?.is_active && (
                  <i className="bi bi-patch-check-fill" aria-label="Verified" />
                )}
              </div>
              <p>{user?.email ?? ''}</p>
            </div>

            <form className="profile-form" onSubmit={handleSave}>
              {message && (
                <div className={`alert alert-${message.type} alert-dismissible`}>
                  {message.text}
                  <button type="button" className="btn-close" onClick={() => setMessage(null)} />
                </div>
              )}

              <section className="profile-form-section">
                <h5>User Info</h5>
                <div className="profile-form-grid profile-form-grid--single">
                  <label className="profile-field">
                    <span>Username</span>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                  </label>
                  <label className="profile-field">
                    <span>Email address</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </label>
                </div>
              </section>

              <section className="profile-form-section">
                <h5>Personal Info</h5>
                <div className="profile-form-grid">
                  <label className="profile-field">
                    <span>First Name</span>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    />
                  </label>
                  <label className="profile-field">
                    <span>Last Name</span>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                  </label>
                </div>
              </section>

              <div className="profile-form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
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
