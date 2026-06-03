import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ContactFormModal from '../components/ContactFormModal'
import {
  EMPTY_CONTACT_FORM,
  formFromContact,
  validateContactPayload,
} from '../lib/contactForm'
import {
  fetchContactsPage,
  createContact,
  updateContact,
  deleteContact,
  type ContactsPage,
  type ContactRecord,
  type ContactPayload,
} from '../services/contacts'
import { fetchMe } from '../services/users'
import { useFeatureAccess } from '../hooks/useFeatureAccess'
import { formatAppDate } from '../lib/formatDateTime'

const EDIT_PARAM = 'edit'

const AVATAR_COLORS = [
  '#9c6cd0', '#6b7785', '#52b585', '#5a8edb',
  '#f0a830', '#d65a5a', '#3e8c84', '#c66bbd',
]

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function initials(first: string, last: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  return '??'
}

function displayName(c: ContactRecord): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || `Contact #${c.id}`
}

const ContactsPage = () => {
  const { canRead: contactsRead, canWrite: contactsWrite } = useFeatureAccess('contacts')
  const [searchParams, setSearchParams] = useSearchParams()
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [contactsTotal, setContactsTotal] = useState(0)
  const [contactsPage, setContactsPage] = useState(0)
  const [contactsHasMore, setContactsHasMore] = useState(false)
  const [contactsLoadingMore, setContactsLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null)
  const [form, setForm] = useState<ContactPayload>({ ...EMPTY_CONTACT_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ContactRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [userCompanyId, setUserCompanyId] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contactsLoadingMoreRef = useRef(false)
  const contactsScrollRef = useRef<HTMLDivElement | null>(null)
  const contactsSentinelRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    fetchMe()
      .then((user) => setUserCompanyId(user.company))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!modalOpen || editingContact != null || userCompanyId == null) return
    setForm((prev) =>
      prev.company_id == null ? { ...prev, company_id: userCompanyId } : prev,
    )
  }, [modalOpen, editingContact, userCompanyId])

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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  const loadContactsPage = useCallback(async (pageNum: number, replace: boolean, q = '') => {
    if (replace) {
      setLoading(true)
    } else {
      if (contactsLoadingMoreRef.current) return
      contactsLoadingMoreRef.current = true
      setContactsLoadingMore(true)
    }
    setError(null)
    try {
      const data: ContactsPage = await fetchContactsPage(pageNum, q)
      setContacts((prev) => (replace ? data.results : [...prev, ...data.results]))
      setContactsTotal(data.count)
      setContactsPage(pageNum)
      setContactsHasMore(data.next != null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contacts')
    } finally {
      if (replace) {
        setLoading(false)
      } else {
        contactsLoadingMoreRef.current = false
        setContactsLoadingMore(false)
      }
    }
  }, [])

  const loadContacts = useCallback(async (q = '') => {
    await loadContactsPage(1, true, q)
  }, [loadContactsPage])

  useEffect(() => {
    loadContacts(debouncedSearch)
  }, [debouncedSearch, loadContacts])

  const loadNextContactsPage = useCallback(() => {
    if (!contactsHasMore || loading || contactsLoadingMore) return
    void loadContactsPage(contactsPage + 1, false, debouncedSearch)
  }, [
    contactsHasMore,
    loading,
    contactsLoadingMore,
    contactsPage,
    debouncedSearch,
    loadContactsPage,
  ])

  const maybeLoadNextContactsPage = useCallback(() => {
    if (!contactsHasMore || loading || contactsLoadingMore) return
    const root = contactsScrollRef.current
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
      loadNextContactsPage()
    }
  }, [contactsHasMore, loading, contactsLoadingMore, loadNextContactsPage])

  const handleContactsScroll = useCallback(() => {
    maybeLoadNextContactsPage()
  }, [maybeLoadNextContactsPage])

  useEffect(() => {
    window.addEventListener('scroll', maybeLoadNextContactsPage, { passive: true })
    return () => window.removeEventListener('scroll', maybeLoadNextContactsPage)
  }, [maybeLoadNextContactsPage])

  // Keep modal in sync with URL param
  useEffect(() => {
    const targetId = searchParams.get(EDIT_PARAM)
    if (!targetId) return
    const contact = contacts.find((c) => String(c.id) === targetId)
    if (!contact) {
      if (!loading) clearEditParam()
      return
    }
    if (editingContact && editingContact.id === contact.id
      && editingContact.updated_at === contact.updated_at) return
    setEditingContact(contact)
    setForm(formFromContact(contact))
    setFormError(null)
    setModalOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, contacts, loading])

  const openAdd = () => {
    clearEditParam()
    setEditingContact(null)
    setForm({
      ...EMPTY_CONTACT_FORM,
      company_id: userCompanyId,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (c: ContactRecord) => writeEditParam(c.id)

  const closeModal = () => {
    clearEditParam()
    setModalOpen(false)
    setEditingContact(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!contactsWrite) return
    setFormError(null)
    const validated = validateContactPayload(form)
    if (!validated.ok) {
      setFormError(validated.error)
      return
    }

    setSaving(true)
    try {
      if (editingContact) {
        await updateContact(editingContact.id, validated.payload)
        setHistoryRefresh((k) => k + 1)
        await loadContacts(debouncedSearch)
      } else {
        const created = await createContact(validated.payload)
        await loadContacts(debouncedSearch)
        writeEditParam(created.id)
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteContact(deleteTarget.id)
      setDeleteTarget(null)
      await loadContacts(debouncedSearch)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

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

  const setField = <K extends keyof ContactPayload>(key: K, val: ContactPayload[K]) =>
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
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search contacts"
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
                {contactsTotal > 0
                  ? `${contacts.length} of ${contactsTotal} contacts`
                  : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
              </span>
              {contactsWrite && (
                <button type="button" className="btn users-btn-add" onClick={openAdd}>
                  <i className="bi bi-plus-lg" /> Add Contact
                </button>
              )}
            </div>
          </div>

          <div
            ref={contactsScrollRef}
            className="users-table-scroll"
            onScroll={handleContactsScroll}
          >
            {loading && contacts.length === 0 ? (
              <div className="users-table-empty-wrap">
                <span className="users-table-empty">Loading contacts...</span>
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
                    <th>Company</th>
                    <th>Phone</th>
                    <th>Created</th>
                    <th className="users-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr
                      key={c.id}
                      className={`users-table-row${contactsRead ? ' users-table-row--clickable' : ''}`}
                      onClick={contactsRead ? () => openEdit(c) : undefined}
                    >
                      <td className="users-table-id">{c.id}</td>
                      <td>
                        <div className="users-table-person">
                          <span
                            className="users-table-avatar"
                            style={{ backgroundColor: avatarColor(c.id) }}
                            aria-hidden="true"
                          >
                            {initials(c.first_name, c.last_name)}
                          </span>
                          <span className="users-table-name">{displayName(c)}</span>
                        </div>
                      </td>
                      <td className="users-table-contact">{c.email || '—'}</td>
                      <td className="users-table-position">{c.company_name || '—'}</td>
                      <td className="users-table-contact">
                        {c.phone_numbers.length
                          ? c.phone_numbers[0].number
                          : '—'}
                        {c.phone_numbers.length > 1 && (
                          <span className="text-muted small ms-1">
                            (+{c.phone_numbers.length - 1})
                          </span>
                        )}
                      </td>
                      <td className="users-table-office">
                        {formatAppDate(c.created_at)}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {(contactsWrite || contactsRead) && (
                          <div className="users-actions">
                            {contactsWrite ? (
                              <>
                                <button
                                  type="button"
                                  className="users-action-btn users-action-edit"
                                  title="Edit contact"
                                  onClick={() => openEdit(c)}
                                >
                                  <i className="bi bi-pencil-square" />
                                </button>
                                <button
                                  type="button"
                                  className="users-action-btn users-action-delete"
                                  title="Delete contact"
                                  onClick={() => setDeleteTarget(c)}
                                >
                                  <i className="bi bi-trash3" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="users-action-btn users-action-edit"
                                title="View contact"
                                onClick={() => openEdit(c)}
                              >
                                <i className="bi bi-eye" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="users-table-empty">
                        {search
                          ? `No contacts found for "${search}".`
                          : 'No contacts yet. Click "Add Contact" to create one.'}
                      </td>
                    </tr>
                  )}
                  {contactsHasMore && contacts.length > 0 && (
                    <tr
                      ref={contactsSentinelRef}
                      className="users-list-sentinel"
                      aria-hidden="true"
                    >
                      <td colSpan={7} />
                    </tr>
                  )}
                  {contactsLoadingMore && (
                    <tr className="users-list-end">
                      <td colSpan={7} className="users-table-empty">
                        Loading more contacts...
                      </td>
                    </tr>
                  )}
                  {!contactsHasMore && contacts.length > 0 && !loading && (
                    <tr className="users-list-end">
                      <td colSpan={7} className="users-table-empty">
                        All {contactsTotal} contacts loaded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <ContactFormModal
          editing={editingContact}
          form={form}
          setField={setField}
          error={formError}
          saving={saving}
          canWrite={contactsWrite}
          onSave={handleSave}
          onClose={closeModal}
          historyRefreshKey={historyRefresh}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          contact={deleteTarget}
          deleting={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Delete confirmation modal                                          */
/* ------------------------------------------------------------------ */

type DeleteConfirmModalProps = {
  contact: ContactRecord
  deleting: boolean
  onConfirm: () => void
  onClose: () => void
}

const DeleteConfirmModal = ({
  contact,
  deleting,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) => (
  <>
    <div className="user-details-modal-backdrop modal-backdrop fade show" onClick={onClose} />
    <div
      className="user-details-modal modal fade show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleteContactTitle"
    >
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header">
            <h1 id="deleteContactTitle" className="modal-title fs-5">Delete Contact</h1>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <p className="mb-0">
              Are you sure you want to delete{' '}
              <strong>{displayName(contact)}</strong>? This action cannot be undone.
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

export default ContactsPage
