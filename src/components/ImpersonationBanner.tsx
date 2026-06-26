import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthSession } from '../context/AuthSessionContext'
import { isImpersonatingSession } from '../services/auth'
import { endImpersonation } from '../services/impersonation'

function displayName(firstName: string, lastName: string, username: string): string {
  const full = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  return full || username
}

const ImpersonationBanner = () => {
  const { currentUser, syncAuthState } = useAuthSession()
  const navigate = useNavigate()
  const [ending, setEnding] = useState(false)

  const impersonating =
    isImpersonatingSession() || Boolean(currentUser?.impersonating)

  const handleExit = useCallback(async () => {
    if (ending) return
    setEnding(true)
    try {
      await endImpersonation()
      syncAuthState()
      navigate('/admin', { replace: true })
    } finally {
      setEnding(false)
    }
  }, [ending, navigate, syncAuthState])

  if (!impersonating || !currentUser) return null

  const label = displayName(
    currentUser.first_name,
    currentUser.last_name,
    currentUser.username,
  )

  return (
    <div className="impersonation-banner" role="status" aria-live="polite">
      <div className="impersonation-banner__inner container-fluid">
        <span className="impersonation-banner__text">
          <i className="bi bi-person-badge me-2" aria-hidden="true" />
          Viewing as <strong>{label}</strong>
          {currentUser.email ? (
            <span className="impersonation-banner__email text-muted">
              {' '}
              ({currentUser.email})
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-light impersonation-banner__exit"
          onClick={() => void handleExit()}
          disabled={ending}
        >
          {ending ? 'Returning…' : 'Exit impersonation'}
        </button>
      </div>
    </div>
  )
}

export default ImpersonationBanner
