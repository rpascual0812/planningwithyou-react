import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  type UserRecord,
  type UserPayload,
} from '../services/users'

const AVATAR_COLORS = [
  '#9c6cd0', '#6b7785', '#52b585', '#5a8edb',
  '#f0a830', '#d65a5a', '#3e8c84', '#c66bbd',
]

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function initials(first: string, last: string, username: string): string {
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase()
  }
  if (first) return first.slice(0, 2).toUpperCase()
  return username.slice(0, 2).toUpperCase()
}

function displayName(u: UserRecord): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ')
  return full || u.username
}

const EMPTY_FORM: UserPayload = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  is_active: true,
  is_staff: false,
  password: '',
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [form, setForm] = useState<UserPayload>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadUsers = useCallback(async (q = '') => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchUsers(q)
      setUsers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers(debouncedSearch)
  }, [debouncedSearch, loadUsers])

  // Add / Edit modal helpers
  const openAdd = () => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (u: UserRecord) => {
    setEditingUser(u)
    setForm({
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: u.is_active,
      is_staff: u.is_staff,
      password: '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingUser(null)
    setFormError(null)
  }

  const handleSave = async () => {
    setFormError(null)
    setSaving(true)
    try {
      if (editingUser) {
        const payload: Partial<UserPayload> = { ...form }
        if (!payload.password) delete payload.password
        await updateUser(editingUser.id, payload)
      } else {
        if (!form.password) {
          setFormError('Password is required for new users.')
          setSaving(false)
          return
        }
        await createUser(form)
      }
      closeModal()
      await loadUsers(debouncedSearch)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Delete helpers
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      await loadUsers(debouncedSearch)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // Escape to close modals
  useEffect(() => {
    if (!modalOpen && !deleteTarget) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null)
        else closeModal()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, deleteTarget])

  const setField = <K extends keyof UserPayload>(key: K, val: UserPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="users-table-card">
          <div className="users-table-toolbar">
            <div className="users-search">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                className="users-search-input"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
              {search && (
                <button
                  type="button"
                  className="users-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
            <div className="users-toolbar-right">
              <span className="users-search-count">
                {users.length} user{users.length !== 1 && 's'}
              </span>
              <button
                type="button"
                className="btn users-btn-add"
                onClick={openAdd}
              >
                <i className="bi bi-plus-lg" /> Add User
              </button>
            </div>
          </div>

          <div className="users-table-scroll">
            {loading && users.length === 0 ? (
              <div className="users-table-empty-wrap">
                <span className="users-table-empty">Loading users...</span>
              </div>
            ) : error ? (
              <div className="users-table-empty-wrap">
                <span className="users-table-empty users-table-error">{error}</span>
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Staff</th>
                    <th>Joined</th>
                    <th className="users-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="users-table-row">
                      <td className="users-table-id">{user.id}</td>
                      <td>
                        <div className="users-table-person">
                          <span
                            className="users-table-avatar"
                            style={{ backgroundColor: avatarColor(user.id) }}
                            aria-hidden="true"
                          >
                            {initials(user.first_name, user.last_name, user.username)}
                          </span>
                          <span className="users-table-name">
                            {displayName(user)}
                          </span>
                        </div>
                      </td>
                      <td className="users-table-contact">{user.email}</td>
                      <td className="users-table-position">{user.username}</td>
                      <td>
                        <span
                          className={`users-status users-status--${user.is_active ? 'active' : 'pending'}`}
                        >
                          {user.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td>
                        {user.is_staff && (
                          <span className="users-badge-staff">staff</span>
                        )}
                      </td>
                      <td className="users-table-office">
                        {new Date(user.date_joined).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="users-actions">
                          <button
                            type="button"
                            className="users-action-btn users-action-edit"
                            title="Edit user"
                            onClick={() => openEdit(user)}
                          >
                            <i className="bi bi-pencil-square" />
                          </button>
                          <button
                            type="button"
                            className="users-action-btn users-action-delete"
                            title="Delete user"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="users-table-empty">
                        {search
                          ? `No users found for "${search}".`
                          : 'No users yet. Click "Add User" to create one.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <UserFormModal
          editing={editingUser}
          form={form}
          setField={setField}
          error={formError}
          saving={saving}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          deleting={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Add / Edit form modal                                              */
/* ------------------------------------------------------------------ */

type UserFormModalProps = {
  editing: UserRecord | null
  form: UserPayload
  setField: <K extends keyof UserPayload>(key: K, val: UserPayload[K]) => void
  error: string | null
  saving: boolean
  onSave: () => void
  onClose: () => void
}

const UserFormModal = ({
  editing,
  form,
  setField,
  error,
  saving,
  onSave,
  onClose,
}: UserFormModalProps) => {
  const title = editing ? 'Edit User' : 'Add User'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave()
  }

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
        aria-labelledby="userFormModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h1 id="userFormModalTitle" className="modal-title fs-5">
                {title}
              </h1>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger py-2" role="alert">
                    {error}
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label">First Name</label>
                    <input
                      className="form-control"
                      value={form.first_name}
                      onChange={(e) => setField('first_name', e.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Last Name</label>
                    <input
                      className="form-control"
                      value={form.last_name}
                      onChange={(e) => setField('last_name', e.target.value)}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Username *</label>
                    <input
                      className="form-control"
                      value={form.username}
                      onChange={(e) => setField('username', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">
                      Password{editing ? ' (leave blank to keep current)' : ' *'}
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      value={form.password ?? ''}
                      onChange={(e) => setField('password', e.target.value)}
                      {...(!editing && { required: true, minLength: 8 })}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="col-sm-6">
                    <div className="form-check form-switch mt-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="userIsActive"
                        checked={form.is_active}
                        onChange={(e) => setField('is_active', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="userIsActive">
                        Active
                      </label>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="form-check form-switch mt-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="userIsStaff"
                        checked={form.is_staff}
                        onChange={(e) => setField('is_staff', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="userIsStaff">
                        Staff
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn users-btn-save"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editing
                      ? 'Update'
                      : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Delete confirmation modal                                          */
/* ------------------------------------------------------------------ */

type DeleteConfirmModalProps = {
  user: UserRecord
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}

const DeleteConfirmModal = ({
  user,
  deleting,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) => (
  <>
    <div
      className="user-details-modal-backdrop modal-backdrop fade show"
      onClick={onClose}
    />
    <div
      className="user-details-modal modal fade show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleteUserModalTitle"
    >
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header">
            <h1 id="deleteUserModalTitle" className="modal-title fs-5">
              Delete User
            </h1>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <p className="mb-0">
              Are you sure you want to delete{' '}
              <strong>{displayName(user)}</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
)

export default UsersPage
