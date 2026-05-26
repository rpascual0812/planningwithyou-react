import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthSession } from '../../context/AuthSessionContext'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import {
  createRole,
  deleteRole,
  emptyPermissions,
  fetchRoleFeatureCatalog,
  fetchRoles,
  updateRole,
  type AccessLevel,
  type FeatureCatalogItem,
  type RolePayload,
  type RoleRecord,
} from '../../services/roles'
import { showErrorToast, showSuccessToast } from '../../utils/toast'

const ACCESS_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
]

const RolesPermissionsSettingsPage = () => {
  const { canWrite: settingsWrite } = useFeatureAccess('settings')
  const { currentUser, syncAuthState } = useAuthSession()

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null)
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [permissions, setPermissions] = useState<Record<string, AccessLevel>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const selectedRole = useMemo(
    () => (typeof selectedId === 'number' ? roles.find((r) => r.id === selectedId) : null),
    [roles, selectedId],
  )

  const isOwner = selectedRole?.name === 'Owner'
  const readOnly = !settingsWrite || isOwner

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [roleRows, featureRows] = await Promise.all([
        fetchRoles(),
        fetchRoleFeatureCatalog(),
      ])
      setRoles(roleRows)
      setCatalog(featureRows)
      setSelectedId((prev) => {
        if (prev === 'new') return prev
        if (typeof prev === 'number' && roleRows.some((r) => r.id === prev)) {
          return prev
        }
        return roleRows[0]?.id ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectedId === 'new') {
      setName('')
      setIsDefault(false)
      setPermissions(emptyPermissions(catalog))
      return
    }
    if (!selectedRole) return
    setName(selectedRole.name)
    setIsDefault(selectedRole.is_default)
    setPermissions({ ...selectedRole.permissions })
  }, [selectedId, selectedRole, catalog])

  const applyPermission = (key: string, access: AccessLevel) => {
    setPermissions((prev) => ({ ...prev, [key]: access }))
  }

  const payload = (): RolePayload => ({
    name: name.trim(),
    is_default: isDefault,
    permissions,
  })

  const handleSave = async () => {
    if (!name.trim()) {
      showErrorToast('Role name is required.')
      return
    }
    setSaving(true)
    try {
      if (selectedId === 'new') {
        const created = await createRole(payload())
        showSuccessToast('Role created.')
        await load()
        setSelectedId(created.id)
      } else if (typeof selectedId === 'number') {
        const updated = await updateRole(selectedId, payload())
        showSuccessToast('Role saved.')
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
        if (currentUser?.role != null && updated.id === currentUser.role) {
          syncAuthState()
        }
      }
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (typeof selectedId !== 'number' || !selectedRole) return
    if (selectedRole.name === 'Owner') return
    if (selectedRole.user_count > 0) {
      showErrorToast('Reassign users before deleting this role.')
      return
    }
    if (!window.confirm(`Delete role "${selectedRole.name}"?`)) return
    setDeleting(true)
    try {
      await deleteRole(selectedId)
      showSuccessToast('Role deleted.')
      await load()
      setSelectedId(null)
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading && roles.length === 0) {
    return <div className="text-muted">Loading roles…</div>
  }

  return (
    <div>
      <p className="text-muted small mb-3">
        Control what each role can see and change. Users inherit permissions from their
        assigned role.
      </p>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="row g-3">
        <div className="col-md-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="text-muted small">{roles.length} role{roles.length !== 1 && 's'}</span>
            {settingsWrite && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setSelectedId('new')}
              >
                <i className="bi bi-plus-lg me-1" />
                New role
              </button>
            )}
          </div>
          <div className="list-group">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`list-group-item list-group-item-action${
                  selectedId === role.id ? ' active' : ''
                }`}
                onClick={() => setSelectedId(role.id)}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <strong>{role.name}</strong>
                    {role.is_default && (
                      <span className="badge bg-secondary ms-2">Default</span>
                    )}
                  </div>
                  <span className="small opacity-75">{role.user_count} users</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-md-8">
          {selectedId == null ? (
            <div className="text-muted small">Select a role to view permissions.</div>
          ) : (
            <>
              {isOwner && (
                <div className="alert alert-info py-2 small">
                  The Owner role always has full access and cannot be edited or deleted.
                </div>
              )}

              <div className="mb-3">
                <label className="form-label" htmlFor="role-name">
                  Role name
                </label>
                <input
                  id="role-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={readOnly || selectedId !== 'new' && isOwner}
                  maxLength={100}
                />
              </div>

              {selectedId !== 'new' && !isOwner && settingsWrite && (
                <div className="form-check mb-3">
                  <input
                    id="role-is-default"
                    type="checkbox"
                    className="form-check-input"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="role-is-default">
                    Default role for new users
                  </label>
                </div>
              )}

              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th className="text-end">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.map((feature) => (
                      <tr key={feature.key}>
                        <td>{feature.label}</td>
                        <td className="text-end">
                          {readOnly ? (
                            <span className="text-muted text-capitalize">
                              {permissions[feature.key] ?? 'none'}
                            </span>
                          ) : (
                            <select
                              className="form-select form-select-sm d-inline-block w-auto"
                              value={permissions[feature.key] ?? 'none'}
                              onChange={(e) =>
                                applyPermission(feature.key, e.target.value as AccessLevel)
                              }
                            >
                              {ACCESS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {settingsWrite && !isOwner && (
                <div className="d-flex gap-2 mt-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : selectedId === 'new' ? 'Create role' : 'Save'}
                  </button>
                  {typeof selectedId === 'number' &&
                    selectedRole &&
                    selectedRole.name !== 'Owner' &&
                    selectedRole.user_count === 0 && (
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting…' : 'Delete role'}
                      </button>
                    )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default RolesPermissionsSettingsPage
