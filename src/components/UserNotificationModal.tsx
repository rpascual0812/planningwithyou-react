import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { formatAppDateTime } from '../lib/formatDateTime'
import type { UserNotificationRecord } from '../services/userNotifications'

type UserNotificationModalProps = {
  notification: UserNotificationRecord | null
  deleting: boolean
  onDelete: () => void
  onClose: () => void
}

const UserNotificationModal = ({
  notification,
  deleting,
  onDelete,
  onClose,
}: UserNotificationModalProps) => {
  if (!notification) return null

  const actionPath = notification.action_url?.trim()

  return createPortal(
    <>
      <div
        className="user-notification-modal-backdrop modal-backdrop fade show"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="modal fade show d-block user-notification-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-notification-modal-title"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="user-notification-modal-title">
                {notification.title}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-2">
                {formatAppDateTime(notification.created_at)}
              </p>
              <p className="mb-0">{notification.message}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-danger me-auto"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              {actionPath && (
                <Link
                  to={actionPath}
                  className="btn btn-primary"
                  onClick={onClose}
                >
                  Open
                </Link>
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}

export default UserNotificationModal
