import { useEffect, useRef, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { UserAvatar } from '../components/UserAvatar'
import { useAuthSession } from '../context/AuthSessionContext'
import { resizeImageFileToSquare } from '../lib/resizeImageFile'
import ProfilePasswordSection from './profile/ProfilePasswordSection'
import ProfileSettingsNav, { useProfileTabNavigation } from './profile/ProfileSettingsNav'
import ProfileSupportSection from './profile/ProfileSupportSection'
import {
  fetchMe,
  restartProductTour,
  updateMe,
  uploadMyPhoto,
  type UserRecord,
} from '../services/users'

function getDisplayName(user: UserRecord): string {
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || user.username || user.email
}

const ProfilePage = () => {
  const { syncAuthState } = useAuthSession()
  const { activeTab, setActiveTab, activeLabel } = useProfileTabNavigation()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<UserRecord | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [form, setForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [tourRestarting, setTourRestarting] = useState(false)
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

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return

    setPhotoUploading(true)
    setMessage(null)
    try {
      const resized = await resizeImageFileToSquare(file, 200)
      const updated = await uploadMyPhoto(resized)
      setUser(updated)
      syncAuthState()
      setMessage({ type: 'success', text: 'Profile photo updated.' })
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err instanceof Error ? err.message : 'Photo upload failed',
      })
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleSave = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage(null)
    try {
      const updated = await updateMe(form)
      setUser(updated)
      syncAuthState()
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
        <div className="settings-layout">
          <ProfileSettingsNav activeTab={activeTab} onTabChange={setActiveTab} />

          <section
            className={`settings-main-card${activeTab === 'profile' ? ' profile-main-card' : ''}`}
          >
            {activeTab === 'support' ? (
              <ProfileSupportSection />
            ) : (
              <>
                <h5 className="settings-card-title">{activeLabel}</h5>
                {activeTab === 'password' ? (
                  <ProfilePasswordSection />
                ) : (
                  <>
                    <div className="profile-cover">
                      <img
                        src="https://picsum.photos/seed/profile-cover-sail/1400/360"
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="profile-identity">
                      <div className="profile-photo-wrap">
                        <UserAvatar
                          user={user}
                          className="profile-photo"
                          initialsClassName="profile-photo-initials"
                          alt={user ? `${getDisplayName(user)} profile photo` : ''}
                        />
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          className="visually-hidden"
                          onChange={handlePhotoChange}
                          disabled={photoUploading || !user}
                        />
                        <button
                          type="button"
                          className="profile-photo-action"
                          aria-label="Change profile photo"
                          disabled={photoUploading || !user}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          <i className={`bi ${photoUploading ? 'bi-arrow-repeat' : 'bi-camera'}`} />
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
                          <button
                            type="button"
                            className="btn-close"
                            onClick={() => setMessage(null)}
                          />
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

                      <section className="profile-form-section">
                        <h5>Guided tour</h5>
                        <p className="text-muted small mb-2">
                          Walk through every menu and settings section again.
                        </p>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={tourRestarting}
                          onClick={async () => {
                            setTourRestarting(true)
                            setMessage(null)
                            try {
                              await restartProductTour()
                              syncAuthState()
                              window.location.assign('/')
                            } catch (err) {
                              setMessage({
                                type: 'danger',
                                text:
                                  err instanceof Error
                                    ? err.message
                                    : 'Could not restart the tour',
                              })
                            } finally {
                              setTourRestarting(false)
                            }
                          }}
                        >
                          {tourRestarting ? 'Starting…' : 'Restart guided tour'}
                        </button>
                      </section>

                      <div className="profile-form-actions">
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
