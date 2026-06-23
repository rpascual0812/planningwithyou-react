import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthSession } from '../context/AuthSessionContext'
import { planGrantsPaidFeatures } from '../lib/subscriptionPlans'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import EditModalHistoryTabs from '../components/EditModalHistoryTabs'
import ResourceHistoryPanel from '../components/ResourceHistoryPanel'
import { validateEmailAddress } from '../lib/formValidators'
import { historyPaths } from '../services/history'
import CompanyFilterSelect from '../components/CompanyFilterSelect'
import { useCompanyFilter } from '../hooks/useCompanyFilter'
import { formatAppDate } from '../lib/formatDateTime'
import {
  fetchUsersPage,
  fetchUserSeatUsage,
  createUser,
  updateUser,
  deleteUser,
  type UserRecord,
  type UserPayload,
  type UsersPage,
  type UserSeatUsage,
} from '../services/users'
import { fetchRoles, type RoleRecord } from '../services/roles'

const EDIT_PARAM = 'edit'

const SEAT_LIMIT_MESSAGE =
  'You have already reached the maximum number of allowed users. ' +
  'Update your plan under Account Settings > Subscription to add more users.'

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

function userStatusLabel(user: UserRecord): string {
  if (user.account_restricted) return 'restricted'
  return user.is_active ? 'active' : 'inactive'
}

function userStatusClass(user: UserRecord): string {
  if (user.account_restricted) return 'users-status--restricted'
  return user.is_active ? 'users-status--active' : 'users-status--pending'
}

const EMPTY_FORM: UserPayload = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  is_active: true,
  role: null,
}

const UsersPage = () => {
  const { currentUser, subscriptionPlan, syncAuthState } = useAuthSession()
  const { canRead: usersRead, canWrite: usersWrite } = useFeatureAccess('users')
  const [seatUsage, setSeatUsage] = useState<UserSeatUsage | null>(null)
  const [seatUsageLoading, setSeatUsageLoading] = useState(true)
  const atSeatLimit = seatUsage?.at_seat_limit === true
  const canManageUser = (user: UserRecord): boolean => !user.account_restricted
  const canAddUser =
    usersWrite &&
    planGrantsPaidFeatures(subscriptionPlan) &&
    !atSeatLimit
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const {
    companies,
    companiesLoading,
    selectedCompanyId,
    setSelectedCompanyId,
    activeCompanyId,
  } = useCompanyFilter({
    onFetchError: setError,
  })
  const [users, setUsers] = useState<UserRecord[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(0)
  const [usersHasMore, setUsersHasMore] = useState(false)
  const [usersLoadingMore, setUsersLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [form, setForm] = useState<UserPayload>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [roles, setRoles] = useState<RoleRecord[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const usersLoadingMoreRef = useRef(false)
  const usersScrollRef = useRef<HTMLDivElement | null>(null)
  const usersSentinelRef = useRef<HTMLTableRowElement | null>(null)

  const writeEditParam = (id: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set(EDIT_PARAM, String(id))
      return next
    }, { replace: true })
  }

  const clearEditParam = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(EDIT_PARAM)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const loadSeatUsage = useCallback(async () => {
    setSeatUsageLoading(true)
    try {
      const usage = await fetchUserSeatUsage()
      setSeatUsage(usage)
    } catch {
      setSeatUsage(null)
    } finally {
      setSeatUsageLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSeatUsage()
  }, [loadSeatUsage])

  useEffect(() => {
    let cancelled = false
    fetchRoles()
      .then((rows) => {
        if (!cancelled) setRoles(rows)
      })
      .catch(() => {
        if (!cancelled) setRoles([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadUsersPage = useCallback(async (
    pageNum: number,
    replace: boolean,
    q = '',
    companyId: number | null = null,
  ) => {
    if (companyId == null) {
      if (replace) {
        setUsers([])
        setUsersTotal(0)
        setUsersPage(0)
        setUsersHasMore(false)
        setLoading(false)
      }
      return
    }
    if (replace) {
      setLoading(true)
    } else {
      if (usersLoadingMoreRef.current) return
      usersLoadingMoreRef.current = true
      setUsersLoadingMore(true)
    }
    setError(null)
    try {
      const data: UsersPage = await fetchUsersPage(pageNum, q, companyId)
      setUsers((prev) => (replace ? data.results : [...prev, ...data.results]))
      setUsersTotal(data.count)
      setUsersPage(pageNum)
      setUsersHasMore(data.next != null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      if (replace) {
        setLoading(false)
      } else {
        usersLoadingMoreRef.current = false
        setUsersLoadingMore(false)
      }
    }
  }, [])

  const loadUsers = useCallback(
    async (q = '', companyId: number | null = null) => {
      await loadUsersPage(1, true, q, companyId)
    },
    [loadUsersPage],
  )

  useEffect(() => {
    void loadUsers(debouncedSearch, activeCompanyId)
  }, [debouncedSearch, activeCompanyId, loadUsers])

  const loadNextUsersPage = useCallback(() => {
    if (!usersHasMore || loading || usersLoadingMore) return
    void loadUsersPage(usersPage + 1, false, debouncedSearch, activeCompanyId)
  }, [
    usersHasMore,
    loading,
    usersLoadingMore,
    usersPage,
    debouncedSearch,
    activeCompanyId,
    loadUsersPage,
  ])

  const maybeLoadNextUsersPage = useCallback(() => {
    if (!usersHasMore || loading || usersLoadingMore) return
    const root = usersScrollRef.current
    const containerHasVerticalScroll =
      !!root && root.scrollHeight > root.clientHeight + 1
    const nearContainerBottom =
      !!root &&
      root.scrollTop + root.clientHeight >= root.scrollHeight - 12
    const page = document.documentElement
    const nearPageBottom =
      window.innerHeight + window.scrollY >= page.scrollHeight - 12
    if (
      (containerHasVerticalScroll && nearContainerBottom) ||
      (!containerHasVerticalScroll && nearPageBottom)
    ) {
      loadNextUsersPage()
    }
  }, [usersHasMore, loading, usersLoadingMore, loadNextUsersPage])

  const handleUsersScroll = useCallback(() => {
    maybeLoadNextUsersPage()
  }, [maybeLoadNextUsersPage])

  useEffect(() => {
    window.addEventListener('scroll', maybeLoadNextUsersPage, { passive: true })
    return () => window.removeEventListener('scroll', maybeLoadNextUsersPage)
  }, [maybeLoadNextUsersPage])

  // Keep modal in sync with URL param and refreshed data
  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId) return
    const user = users.find((u) => String(u.id) === targetId)
    if (!user) {
      if (!loading) clearEditParam()
      return
    }
    if (!canManageUser(user)) {
      clearEditParam()
      return
    }
    if (
      editingUser &&
      editingUser.id === user.id &&
      editingUser.username === user.username &&
      editingUser.email === user.email &&
      editingUser.first_name === user.first_name &&
      editingUser.last_name === user.last_name &&
      editingUser.is_active === user.is_active &&
      editingUser.role === user.role
    ) {
      return
    }
    setEditingUser(user)
    setForm({
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
      role: user.role ?? null,
    })
    setFormError(null)
    setModalOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, users, loading])

  // Add / Edit modal helpers
  const openAdd = () => {
    if (!canAddUser) return
    if (atSeatLimit) return
    clearEditParam()
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (u: UserRecord) => {
    if (!canManageUser(u)) return
    writeEditParam(u.id)
  }

  const closeModal = () => {
    clearEditParam()
    setModalOpen(false)
    setEditingUser(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!usersWrite) return
    if (!editingUser && !canAddUser) {
      if (atSeatLimit) {
        setFormError(SEAT_LIMIT_MESSAGE)
      } else {
        setFormError('Adding users requires a paid subscription plan.')
      }
      return
    }
    const isReactivating =
      editingUser != null && !editingUser.is_active && form.is_active
    if (isReactivating && atSeatLimit) {
      setFormError(SEAT_LIMIT_MESSAGE)
      return
    }
    const emailValidationError = validateEmailAddress(form.email)
    if (emailValidationError) {
      setFormError(emailValidationError)
      return
    }
    setFormError(null)
    setSaving(true)
    const payload = form
    try {
      if (editingUser) {
        await updateUser(editingUser.id, payload)
        if (currentUser && editingUser.id === currentUser.id) {
          syncAuthState()
        }
        setHistoryRefresh((k) => k + 1)
        await loadUsers(debouncedSearch, activeCompanyId)
        await loadSeatUsage()
      } else {
        const email = payload.email.trim()
        const created = await createUser({
          ...payload,
          username: email,
          company: activeCompanyId ?? undefined,
        })
        await loadUsers(debouncedSearch, activeCompanyId)
        await loadSeatUsage()
        writeEditParam(created.id)
      }
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
      await loadUsers(debouncedSearch, activeCompanyId)
      await loadSeatUsage()
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null)
        else closeModal()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
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
          <div className="row g-2 align-items-end mb-0 px-2 pt-2 pb-2 border-bottom">
            <CompanyFilterSelect
              id="users-company"
              companies={companies}
              loading={companiesLoading}
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
            />
          </div>
          {atSeatLimit && planGrantsPaidFeatures(subscriptionPlan) && (
            <div
              className="alert alert-warning py-2 mx-2 mt-2 mb-0"
              role="status"
            >
              You have already reached the maximum number of allowed users
              {seatUsage != null && (
                <>
                  {' '}
                  ({seatUsage.active_users_count} of {seatUsage.team_seats})
                </>
              )}
              . To add more users, update your plan in{' '}
              <Link to="/settings?tab=subscription">
                Account Settings &gt; Subscription
              </Link>
              .
            </div>
          )}
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
                {usersTotal > 0
                  ? `${users.length} of ${usersTotal} users`
                  : `${users.length} user${users.length !== 1 ? 's' : ''}`}
              </span>
              {planGrantsPaidFeatures(subscriptionPlan) && (
                <button
                  type="button"
                  className="btn users-btn-add"
                  onClick={openAdd}
                  disabled={
                    !canAddUser ||
                    activeCompanyId == null ||
                    companiesLoading ||
                    seatUsageLoading
                  }
                  title={
                    atSeatLimit
                      ? 'Maximum users reached for your subscription'
                      : undefined
                  }
                >
                  <i className="bi bi-plus-lg" /> Add User
                </button>
              )}
            </div>
          </div>

          <div
            ref={usersScrollRef}
            className="users-table-scroll"
            onScroll={handleUsersScroll}
          >
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
                    <th>Role</th>
                    <th>Account</th>
                    <th>Created</th>
                    <th className="users-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={[
                        'users-table-row',
                        user.account_restricted ? 'users-table-row--restricted' : '',
                        usersRead && canManageUser(user) ? 'users-table-row--clickable' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={usersRead && canManageUser(user) ? () => openEdit(user) : undefined}
                    >
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
                        <span className={`users-status ${userStatusClass(user)}`}>
                          {userStatusLabel(user)}
                        </span>
                      </td>
                      <td className="users-table-position">
                        {user.role_name?.trim() || '—'}
                      </td>
                      <td className="users-table-office">
                        {user.account ?? '—'}
                      </td>
                      <td className="users-table-office">
                        {formatAppDate(user.created_at)}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {(usersWrite || usersRead) && canManageUser(user) && (
                          <div className="users-actions">
                            {usersWrite ? (
                              <>
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
                              </>
                            ) : (
                              <button
                                type="button"
                                className="users-action-btn users-action-edit"
                                title="View user"
                                onClick={() => openEdit(user)}
                              >
                                <i className="bi bi-eye" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan={9} className="users-table-empty">
                        {search
                          ? `No users found for "${search}".`
                          : 'No users yet. Click "Add User" to create one.'}
                      </td>
                    </tr>
                  )}
                  {usersHasMore && users.length > 0 && (
                    <tr
                      ref={usersSentinelRef}
                      className="users-list-sentinel"
                      aria-hidden="true"
                    >
                      <td colSpan={9} />
                    </tr>
                  )}
                  {usersLoadingMore && (
                    <tr className="users-list-end">
                      <td colSpan={9} className="users-table-empty">
                        Loading more users...
                      </td>
                    </tr>
                  )}
                  {!usersHasMore && users.length > 0 && !loading && (
                    <tr className="users-list-end">
                      <td colSpan={9} className="users-table-empty">
                        All {usersTotal} users loaded
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
          canWrite={usersWrite}
          roles={roles}
          onSave={handleSave}
          onClose={closeModal}
          historyRefreshKey={historyRefresh}
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
  canWrite: boolean
  roles: RoleRecord[]
  onSave: () => void
  onClose: () => void
  historyRefreshKey?: number
}

const UserFormModal = ({
  editing,
  form,
  setField,
  error,
  saving,
  canWrite,
  roles,
  onSave,
  onClose,
  historyRefreshKey = 0,
}: UserFormModalProps) => {
  const readOnly = !canWrite
  const title = editing ? (canWrite ? 'Edit User' : 'View User') : 'Add User'
  const [emailError, setEmailError] = useState<string | null>(null)
  const [tab, setTab] = useState<'details' | 'history'>('details')
  const showHistory = editing != null

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (readOnly) return
    const nextEmailError = validateEmailAddress(form.email)
    setEmailError(nextEmailError)
    if (nextEmailError) return
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
                <EditModalHistoryTabs tab={tab} onTab={setTab} showHistory={showHistory} />
                {tab === 'history' && editing ? (
                  <ResourceHistoryPanel
                    historyPath={historyPaths.user(editing.id)}
                    refreshKey={historyRefreshKey}
                  />
                ) : (
                <>
                {error && (
                  <div className="alert alert-danger py-2" role="alert">
                    {error}
                  </div>
                )}
                {!editing && canWrite && (
                  <div className="alert alert-info py-2 mb-3" role="status">
                    <i className="bi bi-envelope me-1" />
                    A password-setup email will be sent to the user.
                  </div>
                )}
                <fieldset
                  disabled={readOnly}
                  className="border-0 m-0 p-0 min-w-0"
                >
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
                  <div className="col-12">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className={`form-control${emailError ? ' is-invalid' : ''}`}
                      value={form.email}
                      onChange={(e) => {
                        setField('email', e.target.value)
                        if (emailError) {
                          setEmailError(validateEmailAddress(e.target.value))
                        }
                      }}
                      onBlur={() => setEmailError(validateEmailAddress(form.email))}
                      required
                      aria-invalid={emailError ? true : undefined}
                    />
                    {emailError && (
                      <div className="invalid-feedback d-block">{emailError}</div>
                    )}
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
                  <div className="col-12">
                    <label className="form-label" htmlFor="userRole">
                      Role
                    </label>
                    <select
                      id="userRole"
                      className="form-select"
                      value={form.role ?? ''}
                      onChange={(e) =>
                        setField(
                          'role',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">Account default</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                          {role.is_default ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                </fieldset>
                </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  {readOnly ? 'Close' : 'Cancel'}
                </button>
                {canWrite && (
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
                )}
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
