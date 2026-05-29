import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchPublicRsvpList,
  getPublicRsvpExportUrl,
  type PublicRsvpListResponse,
} from '../services/templateStudioApi'
import '../features/template-studio/styles/public-rsvp-list.css'

function formatSubmittedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const PublicInvitationRsvpPage = () => {
  const { slug = '' } = useParams()
  const [data, setData] = useState<PublicRsvpListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.documentElement.classList.add('public-invitation-active')
    return () => document.documentElement.classList.remove('public-invitation-active')
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchPublicRsvpList(slug)
      .then((record) => {
        if (!cancelled) setData(record)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const columns = useMemo(() => data?.field_columns ?? [], [data?.field_columns])
  const rows = data?.results ?? []

  if (loading) {
    return (
      <div className="public-rsvp-page public-rsvp-page--loading">
        Loading RSVP responses…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="public-rsvp-page public-rsvp-page--error">
        <h1 className="h4">RSVP list unavailable</h1>
        <p className="text-muted">This invitation may be unpublished or the link is incorrect.</p>
      </div>
    )
  }

  return (
    <div className="public-rsvp-page">
      <header className="public-rsvp-header">
        <div>
          <p className="public-rsvp-eyebrow mb-1">RSVP responses</p>
          <h1 className="public-rsvp-title h4 mb-0">{data.title}</h1>
        </div>
        <div className="public-rsvp-actions">
          <a
            className="btn btn-sm btn-outline-secondary"
            href={getPublicRsvpExportUrl(slug)}
            download
          >
            <i className="bi bi-file-earmark-spreadsheet me-1" aria-hidden="true" />
            Export to Excel
          </a>
          <Link className="btn btn-sm btn-link" to={`/invitations/${slug}`}>
            View invitation
          </Link>
        </div>
      </header>

      <div className="public-rsvp-table-wrap">
        {rows.length === 0 ? (
          <p className="text-muted mb-0 p-4">No RSVP submissions yet.</p>
        ) : (
          <table className="table table-sm table-hover public-rsvp-table mb-0">
            <thead>
              <tr>
                <th scope="col">Submitted</th>
                {columns.map((col) => (
                  <th key={col.id} scope="col">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="text-nowrap">{formatSubmittedAt(row.created_at)}</td>
                  {columns.map((col) => (
                    <td key={col.id}>{row.fields_data[col.id] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="public-rsvp-footer text-muted small mb-0">
        {rows.length} response{rows.length === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export default PublicInvitationRsvpPage
