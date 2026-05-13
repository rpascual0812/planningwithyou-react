import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAccessToken } from '../services/auth'
import {
  ApiRequestError,
  createUser,
  deleteUser,
  fetchAuthMe,
  fetchUsers,
  updateUser,
  type ApiUser,
  type AuthMe,
  type UserCreatePayload,
  type UserUpdatePayload,
} from '../services/usersApi'

const USER_PARAM = 'user'

const AVATAR_PALETTE = [
  '#9c6cd0',
  '#6b7785',
  '#52b585',
  '#5a8edb',
  '#f0a830',
  '#d65a5a',
  '#1f3a5f',
  '#c45c9c',
]

function avatarColor(id: number): string {
  return AVATAR_PALETTE[Math.abs(id) % AVATAR_PALETTE.length]
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatJoined(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

const SEARCH_DEBOUNCE_MS = 350

const UsersPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<AuthMe | null>(null)

  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadUsers = useCallback(async () => {
    if (!getAccessToken()) {
      setUsers([])
      setLoading(false)
      setError('You need to sign in to manage users.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [list, profile] = await Promise.all([
        fetchUsers(debouncedSearch),
        fetchAuthMe().catch(() => null),
      ])
      setUsers(list)
      setMe(profile)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to load users.'
      setError(message)
      setUsers([])
      if (e instanceof ApiRequestError && e.status === 401) {
        navigate('/login', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, navigate])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const clearUserParam = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!next.has(USER_PARAM)) {
          return prev
        }
        next.delete(USER_PARAM)
        return next
      },
      { replace: true },
    )
  }

  const openUser = (user: ApiUser) => {
    setSelectedUser(user)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(USER_PARAM, String(user.id))
        return next
      },
      { replace: true },
    )
  }

  const closeUser = () => {
    setSelectedUser(null)
    clearUserParam()
  }

  useEffect(() => {
    const targetId = searchParams.get(USER_PARAM)
    if (!targetId) {
      return
    }
    const idNum = Number(targetId)
    if (!Number.isFinite(idNum)) {
      clearUserParam()
      return
    }
    const user = users.find((u) => u.id === idNum)
    if (!user && !loading) {
      clearUserParam()
      return
    }
    if (user && selectedUser?.id !== user.id) {
      setSelectedUser(user)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, users, loading])

  useEffect(() => {
    if (!selectedUser && !userToDelete && !formMode) {
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (userToDelete) {
          setUserToDelete(null)
        } else if (formMode) {
          setFormMode(null)
        } else {
          closeUser()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser, userToDelete, formMode])

  const displayName = (u: ApiUser) => u.full_name || u.username

  const totalLabel = useMemo(() => {
    if (debouncedSearch) {
      return `${users.length} match${users.length === 1 ? '' : 'es'}`
    }
    return `${users.length} user${users.length === 1 ? '' : 's'}`
  }, [users.length, debouncedSearch])

  const handleCreated = async (payload: UserCreatePayload) => {
    setFormSubmitting(true)
    setError(null)
    try {
      await createUser(payload)
      setFormMode(null)
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create user.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleUpdated = async (id: number, payload: UserUpdatePayload) => {
    setFormSubmitting(true)
    setError(null)
    try {
      await updateUser(id, payload)
      setFormMode(null)
      setSelectedUser(null)
      clearUserParam()
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update user.')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) {
      return
    }
    setDeleteSubmitting(true)
    setError(null)
    try {
      await deleteUser(userToDelete.id)
      setUserToDelete(null)
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null)
        clearUserParam()
      }
      await loadUsers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete user.')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <div className="app-content">
      <div className="container-fluid">
        {error && (
          <div className="alert alert-danger mb-3" role="alert">
            {error}
          </div>
        )}

        <div className="users-table-card">
          <div className="users-table-toolbar">
            <div className="users-search">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                className="users-search-input"
                placeholder="Search by name, username, or email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search users"
                disabled={!getAccessToken()}
              />
              {searchInput && (
                <button
                  type="button"
                  className="users-search-clear"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                >
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
            <div className="users-toolbar-right">
              <span className="users-search-count">{totalLabel}</span>
              <button
                type="button"
                className="btn btn-primary btn-sm users-add-btn"
                disabled={!getAccessToken() || loading}
                onClick={() => {
                  setError(null)
                  setFormMode('create')
                }}
              >
                <i className="bi bi-person-plus me-1" aria-hidden="true" />
                Add user
              </button>
            </div>
          </div>
          <div className="users-table-scroll">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Active</th>
                  <th>Staff</th>
                  <th>Joined</th>
                  <th className="users-table-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="users-table-empty">
                      Loading users…
                    </td>
                  </tr>
                )}
                {!loading &&
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="users-table-row"
                      onClick={() => openUser(user)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openUser(user)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open details for ${displayName(user)}`}
                    >
                      <td className="users-table-id">{user.id}</td>
                      <td>
                        <div className="users-table-person">
                          <span
                            className="users-table-avatar"
                            style={{ backgroundColor: avatarColor(user.id) }}
                            aria-hidden="true"
                          >
                            {initials(displayName(user))}
                          </span>
                          <span className="users-table-name">
                            {displayName(user)}
                          </span>
                        </div>
                      </td>
                      <td className="users-table-office">{user.username}</td>
                      <td className="users-table-contact">{user.email}</td>
                      <td>
                        <span
                          className={`users-status users-status--${user.is_active ? 'active' : 'inactive'}`}
                        >
                          {user.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="users-table-position">
                        {user.is_staff ? (
                          <span className="badge text-bg-secondary">Staff</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="users-table-salary text-body-secondary small">
                        {formatJoined(user.date_joined)}
                      </td>
                      <td className="users-table-actions-col">
                        <div
                          className="users-table-actions"
                          role="presentation"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-decoration-none p-0 me-2"
                            aria-label={`Edit ${displayName(user)}`}
                            onClick={() => {
                              setError(null)
                              setSelectedUser(user)
                              setFormMode('edit')
                            }}
                          >
                            <i className="bi bi-pencil-square" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-danger text-decoration-none p-0"
                            aria-label={`Delete ${displayName(user)}`}
                            disabled={me?.id === user.id}
                            title={
                              me?.id === user.id
                                ? 'You cannot delete your own account'
                                : undefined
                            }
                            onClick={() => {
                              setError(null)
                              setUserToDelete(user)
                            }}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="users-table-empty">
                      {debouncedSearch
                        ? `No users found for "${debouncedSearch}".`
                        : 'No users yet. Add a user to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedUser && !formMode && (
        <UserDetailsModal
          user={selectedUser}
          onClose={closeUser}
          onEdit={() => {
            setError(null)
            setFormMode('edit')
          }}
        />
      )}

      {formMode === 'create' && (
        <UserFormModal
          mode="create"
          canManageSuperuser={me?.is_superuser ?? false}
          submitting={formSubmitting}
          onClose={() => setFormMode(null)}
          onSubmitCreate={handleCreated}
        />
      )}

      {formMode === 'edit' && selectedUser && (
        <UserFormModal
          mode="edit"
          user={selectedUser}
          canManageSuperuser={me?.is_superuser ?? false}
          submitting={formSubmitting}
          onClose={() => setFormMode(null)}
          onSubmitUpdate={handleUpdated}
        />
      )}

      {userToDelete && (
        <ConfirmDeleteModal
          name={displayName(userToDelete)}
          submitting={deleteSubmitting}
          onCancel={() => setUserToDelete(null)}
          onConfirm={() => void handleDeleteConfirm()}
        />
      )}
    </div>
  )
}

type UserDetailsModalProps = {
  user: ApiUser
  onClose: () => void
  onEdit: () => void
}

const UserDetailsModal = ({ user, onClose, onEdit }: UserDetailsModalProps) => {
  const name = user.full_name || user.username
  return (
    <>
      <div
        className="user-details-modal-backdrop modal-backdrop fade show"
        onClick={onClose}
      />
      <div
        className="user-details-modal modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="userDetailsModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="userDetailsModalTitle" className="modal-title fs-5">
                User details
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <div className="user-details-head">
                <span
                  className="user-details-avatar"
                  style={{ backgroundColor: avatarColor(user.id) }}
                  aria-hidden="true"
                >
                  {initials(name)}
                </span>
                <div>
                  <div className="user-details-name">{name}</div>
                  <div className="user-details-position text-muted small">
                    @{user.username}
                  </div>
                </div>
              </div>

              <dl className="user-details-grid">
                <div>
                  <dt>Id</dt>
                  <dd>{user.id}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>Active</dt>
                  <dd>
                    <span
                      className={`users-status users-status--${user.is_active ? 'active' : 'inactive'}`}
                    >
                      {user.is_active ? 'active' : 'inactive'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Staff</dt>
                  <dd>{user.is_staff ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt>Superuser</dt>
                  <dd>{user.is_superuser ? 'Yes' : 'No'}</dd>
                </div>
                <div className="user-details-grid-wide">
                  <dt>Joined</dt>
                  <dd>{formatJoined(user.date_joined)}</dd>
                </div>
              </dl>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onEdit}
              >
                <i className="bi bi-pencil-square me-1" aria-hidden="true" />
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

type UserFormModalProps = {
  mode: 'create' | 'edit'
  user?: ApiUser
  canManageSuperuser: boolean
  submitting: boolean
  onClose: () => void
  onSubmitCreate?: (payload: UserCreatePayload) => void
  onSubmitUpdate?: (id: number, payload: UserUpdatePayload) => void
}

const UserFormModal = ({
  mode,
  user,
  canManageSuperuser,
  submitting,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
}: UserFormModalProps) => {
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [isActive, setIsActive] = useState(user?.is_active ?? true)
  const [isStaff, setIsStaff] = useState(user?.is_staff ?? false)
  const [isSuperuser, setIsSuperuser] = useState(user?.is_superuser ?? false)

  const title = mode === 'create' ? 'Add user' : 'Edit user'

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (mode === 'create') {
      onSubmitCreate?.({
        username: username.trim(),
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_active: isActive,
        is_staff: isStaff,
        is_superuser: canManageSuperuser ? isSuperuser : false,
      })
    } else if (user) {
      const payload: UserUpdatePayload = {
        username: username.trim(),
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_active: isActive,
        is_staff: isStaff,
      }
      if (canManageSuperuser) {
        payload.is_superuser = isSuperuser
      }
      if (password.trim()) {
        payload.password = password
      }
      onSubmitUpdate?.(user.id, payload)
    }
  }

  return (
    <>
      <div
        className="user-details-modal-backdrop modal-backdrop fade show"
        onClick={() => !submitting && onClose()}
      />
      <div
        className="user-details-modal modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="userFormModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="userFormModalTitle" className="modal-title fs-5">
                {title}
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                disabled={submitting}
                onClick={onClose}
              />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="user-username">
                      Username
                    </label>
                    <input
                      id="user-username"
                      className="form-control"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="user-email">
                      Email
                    </label>
                    <input
                      id="user-email"
                      type="email"
                      className="form-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="user-first">
                      First name
                    </label>
                    <input
                      id="user-first"
                      className="form-control"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="user-last">
                      Last name
                    </label>
                    <input
                      id="user-last"
                      className="form-control"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="user-password">
                      Password
                      {mode === 'edit' && (
                        <span className="text-muted fw-normal ms-1">
                          (leave blank to keep current)
                        </span>
                      )}
                    </label>
                    <input
                      id="user-password"
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={mode === 'create'}
                      minLength={mode === 'create' ? 8 : undefined}
                      autoComplete="new-password"
                      disabled={submitting}
                    />
                  </div>
                  <div className="col-12 d-flex flex-wrap gap-3">
                    <div className="form-check">
                      <input
                        id="user-active"
                        type="checkbox"
                        className="form-check-input"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        disabled={submitting}
                      />
                      <label className="form-check-label" htmlFor="user-active">
                        Active
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        id="user-staff"
                        type="checkbox"
                        className="form-check-input"
                        checked={isStaff}
                        onChange={(e) => setIsStaff(e.target.checked)}
                        disabled={submitting}
                      />
                      <label className="form-check-label" htmlFor="user-staff">
                        Staff
                      </label>
                    </div>
                    {canManageSuperuser && (
                      <div className="form-check">
                        <input
                          id="user-super"
                          type="checkbox"
                          className="form-check-input"
                          checked={isSuperuser}
                          onChange={(e) => setIsSuperuser(e.target.checked)}
                          disabled={submitting}
                        />
                        <label className="form-check-label" htmlFor="user-super">
                          Superuser
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submitting}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : mode === 'create' ? 'Create user' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

type ConfirmDeleteModalProps = {
  name: string
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

const ConfirmDeleteModal = ({
  name,
  submitting,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) => (
  <>
    <div
      className="user-details-modal-backdrop modal-backdrop fade show"
      onClick={() => !submitting && onCancel()}
    />
    <div
      className="user-details-modal modal fade show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmDeleteTitle"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h1 id="confirmDeleteTitle" className="modal-title fs-5">
              Delete user
            </h1>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              disabled={submitting}
              onClick={onCancel}
            />
          </div>
          <div className="modal-body">
            Delete <strong>{name}</strong>? This cannot be undone.
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={submitting}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={submitting}
              onClick={onConfirm}
            >
              {submitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
)

export default UsersPage
