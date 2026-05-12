import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

type UserStatus = 'active' | 'pending'

type UserRow = {
  id: number
  name: string
  position: string
  office: string
  status: UserStatus
  salary: string
  contact: string
  avatarColor: string
}

const USERS: UserRow[] = [
  {
    id: 1,
    name: 'Tiger Nixon',
    position: 'Architect',
    office: 'Edinburgh',
    status: 'active',
    salary: '$320,800',
    contact: '+1 (025) 466-7506',
    avatarColor: '#9c6cd0',
  },
  {
    id: 2,
    name: 'Garrett',
    position: 'Accountant',
    office: 'Tokyo',
    status: 'pending',
    salary: '$170,750',
    contact: '+1 (790) 476-9505',
    avatarColor: '#6b7785',
  },
  {
    id: 3,
    name: 'Ashton Cox',
    position: 'Technical',
    office: 'Francisco',
    status: 'pending',
    salary: '$86,000',
    contact: '+1 (227) 375-6641',
    avatarColor: '#52b585',
  },
  {
    id: 4,
    name: 'Cedric Kelly',
    position: 'Developer',
    office: 'Edinburgh',
    status: 'active',
    salary: '$433,060',
    contact: '+1 (213) 619-7749',
    avatarColor: '#5a8edb',
  },
  {
    id: 5,
    name: 'Airi Satou',
    position: 'Accountant',
    office: 'Tokyo',
    status: 'pending',
    salary: '$162,700',
    contact: '+1 (152) 465-2290',
    avatarColor: '#f0a830',
  },
  {
    id: 6,
    name: 'Williamson',
    position: 'Integration',
    office: 'New York',
    status: 'active',
    salary: '$372,000',
    contact: '+1 (185) 793-4446',
    avatarColor: '#d65a5a',
  },
]

/** URL query param key used to deep-link / restore an open user details modal. */
const USER_PARAM = 'user'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const UsersPage = () => {
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return USERS
    }
    return USERS.filter((user) =>
      [
        user.id,
        user.name,
        user.position,
        user.office,
        user.status,
        user.salary,
        user.contact,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [search])

  /**
   * Remove the deep-link query param without affecting any other params
   * that might exist on the route.
   */
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

  const openUser = (user: UserRow) => {
    setSelectedUser(user)
    // Persist the open modal in the URL so a refresh restores it.
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

  /**
   * Reopen the user details modal if the URL carries a matching
   * `?user=<id>`. Survives refresh and makes the URL shareable.
   */
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
    const user = USERS.find((u) => u.id === idNum)
    if (!user) {
      clearUserParam()
      return
    }
    if (selectedUser?.id === user.id) {
      return
    }
    setSelectedUser(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Body scroll lock + Escape-to-close while the modal is open.
  useEffect(() => {
    if (!selectedUser) {
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeUser()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser])

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
            <span className="users-search-count">
              {filteredUsers.length} of {USERS.length} users
            </span>
          </div>
          <div className="users-table-scroll">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Office</th>
                  <th>Status</th>
                  <th>Salary</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
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
                    aria-label={`Open details for ${user.name}`}
                  >
                    <td className="users-table-id">{user.id}</td>
                    <td>
                      <div className="users-table-person">
                        <span
                          className="users-table-avatar"
                          style={{ backgroundColor: user.avatarColor }}
                          aria-hidden="true"
                        >
                          {initials(user.name)}
                        </span>
                        <span className="users-table-name">{user.name}</span>
                      </div>
                    </td>
                    <td className="users-table-position">{user.position}</td>
                    <td className="users-table-office">{user.office}</td>
                    <td>
                      <span className={`users-status users-status--${user.status}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="users-table-salary">{user.salary}</td>
                    <td className="users-table-contact">{user.contact}</td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="users-table-empty">
                      No users found for "{search}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserDetailsModal user={selectedUser} onClose={closeUser} />
      )}
    </div>
  )
}

type UserDetailsModalProps = {
  user: UserRow
  onClose: () => void
}

const UserDetailsModal = ({ user, onClose }: UserDetailsModalProps) => {
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
                  style={{ backgroundColor: user.avatarColor }}
                  aria-hidden="true"
                >
                  {initials(user.name)}
                </span>
                <div>
                  <div className="user-details-name">{user.name}</div>
                  <div className="user-details-position">{user.position}</div>
                </div>
              </div>

              <dl className="user-details-grid">
                <div>
                  <dt>Id</dt>
                  <dd>{user.id}</dd>
                </div>
                <div>
                  <dt>Office</dt>
                  <dd>{user.office}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className={`users-status users-status--${user.status}`}>
                      {user.status}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Salary</dt>
                  <dd className="users-table-salary">{user.salary}</dd>
                </div>
                <div className="user-details-grid-wide">
                  <dt>Contact</dt>
                  <dd>{user.contact}</dd>
                </div>
              </dl>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default UsersPage
