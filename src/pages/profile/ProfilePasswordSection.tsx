import { useState, type SubmitEvent } from 'react'
import PasswordInput from '../../components/PasswordInput'
import { changeMyPassword } from '../../services/users'
import { showErrorToast, showSuccessToast } from '../../utils/toast'

const ProfilePasswordSection = () => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      showErrorToast('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      showErrorToast('New passwords do not match.')
      return
    }

    setSaving(true)
    try {
      await changeMyPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showSuccessToast('Password updated successfully.')
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-form profile-form--settings" onSubmit={handleSubmit}>
      <section className="profile-form-section profile-form-section--first">
          <p className="text-muted small mb-3">
            Enter your current password, then choose a new one. You will stay signed in after
            updating.
          </p>
          <div className="profile-form-grid profile-form-grid--single">
            <label className="profile-field">
              <span>Current password</span>
              <PasswordInput
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="profile-field">
              <span>New password</span>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label className="profile-field">
              <span>Confirm new password</span>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          </div>
        </section>

        <div className="profile-form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
  )
}

export default ProfilePasswordSection
