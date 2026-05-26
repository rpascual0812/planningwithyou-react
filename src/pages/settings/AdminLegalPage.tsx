import { Editor } from '@tinymce/tinymce-react'
import { useCallback, useEffect, useState } from 'react'
import { useFeatureAccess } from '../../hooks/useFeatureAccess'
import { LEGAL_CONTENT_EDITOR_INIT } from '../../lib/tinymceLegalContent'
import { TINYMCE_EDITOR_SHARED_PROPS } from '../../lib/tinymceFreeEditor'
import {
  fetchAdminSystemLegal,
  updateAdminSystemLegal,
  type LegalDocumentName,
} from '../../services/adminSystemLegal'
import { showErrorToast, showSuccessToast } from '../../utils/toast'

const LEGAL_DOCUMENTS: { name: LegalDocumentName; label: string }[] = [
  { name: 'privacy_policy', label: 'Privacy Policy' },
  { name: 'terms_condition', label: 'Terms & Conditions' },
  { name: 'terms_use', label: 'Terms of Use' },
]

const AdminLegalPage = () => {
  const { canWrite: legalWrite } = useFeatureAccess('admin_legal')
  const [activeDoc, setActiveDoc] = useState<LegalDocumentName>('privacy_policy')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)

  const loadDocument = useCallback(async (name: LegalDocumentName) => {
    setLoading(true)
    setError(null)
    try {
      const row = await fetchAdminSystemLegal(name)
      setValue(row.value ?? '')
      setEditorKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load document')
      setValue('')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocument(activeDoc)
  }, [activeDoc, loadDocument])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateAdminSystemLegal(activeDoc, value)
      showSuccessToast('Document saved.')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save document'
      setError(message)
      showErrorToast(message)
    } finally {
      setSaving(false)
    }
  }

  const activeLabel =
    LEGAL_DOCUMENTS.find((d) => d.name === activeDoc)?.label ?? 'Document'

  return (
    <div className="admin-legal-page">
      <ul className="nav nav-tabs mb-3" role="tablist">
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc.name} className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link${activeDoc === doc.name ? ' active' : ''}`}
              role="tab"
              aria-selected={activeDoc === doc.name}
              onClick={() => setActiveDoc(doc.name)}
            >
              {doc.label}
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted small mb-0">Loading…</p>
      ) : (
        <>
          <p className="text-muted small mb-2">{activeLabel}</p>
          <div className="admin-legal-editor mb-3">
            <Editor
              {...TINYMCE_EDITOR_SHARED_PROPS}
              key={editorKey}
              value={value}
              disabled={!legalWrite}
              onEditorChange={(content) => setValue(content)}
              init={LEGAL_CONTENT_EDITOR_INIT}
            />
          </div>
          {legalWrite && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default AdminLegalPage
