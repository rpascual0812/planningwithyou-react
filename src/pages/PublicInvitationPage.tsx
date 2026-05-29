import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import InvitationRenderer from '../features/template-studio/renderer/InvitationRenderer'
import { fetchPublicInvitation } from '../services/templateStudioApi'
import type { PublicInvitationRecord } from '../services/templateStudioApi'
import '../features/template-studio/styles/invitation-public.css'

const PublicInvitationPage = () => {
  const { slug = '' } = useParams()
  const [data, setData] = useState<PublicInvitationRecord | null>(null)
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
    void fetchPublicInvitation(slug)
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

  if (loading) {
    return (
      <div className="public-invitation-page public-invitation-page--loading">
        Loading invitation…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="public-invitation-page public-invitation-page--error">
        <h1 className="h4">Invitation not found</h1>
        <p className="text-muted">This link may be unpublished or incorrect.</p>
      </div>
    )
  }

  return (
    <div className="public-invitation-page">
      <InvitationRenderer document={data.document} />
    </div>
  )
}

export default PublicInvitationPage
