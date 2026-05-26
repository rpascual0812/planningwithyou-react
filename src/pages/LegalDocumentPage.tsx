import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LegalDocumentName } from '../services/adminSystemLegal'
import {
  LEGAL_DOCUMENT_ROUTES,
  LEGAL_NAME_BY_PATH,
  fetchPublicSystemLegal,
} from '../services/systemLegal'

const LegalDocumentPage = () => {
  const { pathname } = useLocation()
  const docName = LEGAL_NAME_BY_PATH[pathname] as LegalDocumentName | undefined
  const meta = docName ? LEGAL_DOCUMENT_ROUTES[docName] : null

  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!docName) {
      setLoading(false)
      setError('Document not found.')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchPublicSystemLegal(docName)
      .then((row) => {
        if (!cancelled) setHtml(row.value ?? '')
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load document')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [docName])

  return (
    <div className="auth-layout legal-document-page">
      <div className="container py-4 py-md-5">
        <div className="legal-document-card mx-auto">
          <header className="mb-4">
            <Link to="/login" className="legal-document-back small">
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />
              Back to login
            </Link>
            <h1 className="h4 mb-0 mt-3">{meta?.title ?? 'Legal document'}</h1>
          </header>

          {loading && <p className="text-muted mb-0">Loading…</p>}
          {error && (
            <p className="text-danger mb-0" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && (
            <div
              className="legal-document-body"
              dangerouslySetInnerHTML={{
                __html: html.trim() || '<p class="text-muted">No content yet.</p>',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default LegalDocumentPage
