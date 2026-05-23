import { useEffect, useState } from 'react'
import { apiFetch, buildApiUrl } from '../services/api'
import { getAccessToken } from '../services/auth'

type Props = {
  label: string
  fileUrl: string
  /** When false, only preview/download render (parent supplies the heading). */
  showLabel?: boolean
}

type PreviewKind = 'image' | 'pdf' | 'download' | 'external'

function resolveFetchUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return buildApiUrl(trimmed.startsWith('/') ? trimmed : `/${trimmed}`)
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      return star[1].trim()
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() ?? null
}

function extensionFromPath(pathOrUrl: string): string {
  try {
    const path = pathOrUrl.includes('://')
      ? new URL(pathOrUrl).pathname
      : pathOrUrl
    const base = path.split('/').pop() ?? ''
    const dot = base.lastIndexOf('.')
    return dot >= 0 ? base.slice(dot + 1).toLowerCase() : ''
  } catch {
    return ''
  }
}

function guessMime(ext: string, contentType: string): string {
  const ct = contentType.split(';')[0].trim().toLowerCase()
  if (ct && ct !== 'application/octet-stream') return ct
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }
  return map[ext] ?? 'application/octet-stream'
}

function previewKindForMime(mime: string, ext: string): PreviewKind {
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image'
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf'
  }
  return 'download'
}

const KybDocumentDisplay = ({ label, fileUrl, showLabel = true }: Props) => {
  const trimmed = (fileUrl ?? '').trim()
  const [loading, setLoading] = useState(Boolean(trimmed))
  const [error, setError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState('document')
  const [previewKind, setPreviewKind] = useState<PreviewKind>('download')

  useEffect(() => {
    if (!trimmed) {
      setLoading(false)
      setError(null)
      setObjectUrl(null)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      setObjectUrl(null)

      const fetchUrl = resolveFetchUrl(trimmed)
      const isAppFile = /\/files\/d\/\d+/i.test(fetchUrl)

      if (!isAppFile && /^https?:\/\//i.test(trimmed)) {
        const ext = extensionFromPath(trimmed)
        const kind = previewKindForMime('', ext)
        if (kind === 'image') {
          if (!cancelled) {
            setPreviewKind('external')
            setObjectUrl(trimmed)
            setFilename(ext ? `file.${ext}` : 'document')
            setLoading(false)
          }
          return
        }
        if (!cancelled) {
          setPreviewKind('download')
          setObjectUrl(trimmed)
          setFilename(ext ? `file.${ext}` : 'document')
          setLoading(false)
        }
        return
      }

      try {
        const headers: Record<string, string> = { Accept: '*/*' }
        const token = getAccessToken()
        if (token) headers.Authorization = `Bearer ${token}`

        const res = await apiFetch(fetchUrl, { headers })
        if (!res.ok) {
          throw new Error('Could not load document')
        }

        const contentType = res.headers.get('Content-Type') ?? ''
        const ext = extensionFromPath(
          filenameFromDisposition(res.headers.get('Content-Disposition')) ??
            fetchUrl,
        )
        const resolvedMime = guessMime(ext, contentType)
        const blob = await res.blob()
        const nextBlobUrl = URL.createObjectURL(blob)

        if (cancelled) {
          URL.revokeObjectURL(nextBlobUrl)
          return
        }

        setFilename(
          filenameFromDisposition(res.headers.get('Content-Disposition')) ??
            (ext ? `document.${ext}` : 'document'),
        )
        setPreviewKind(previewKindForMime(resolvedMime, ext))
        setObjectUrl(nextBlobUrl)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load document')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [trimmed])

  useEffect(() => {
    return () => {
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [objectUrl])

  if (!trimmed) {
    return (
      <div className="kyb-document-display mb-3">
        {showLabel && <div className="text-muted small mb-1">{label}</div>}
        <div className="small text-muted">—</div>
      </div>
    )
  }

  const downloadHref = objectUrl ?? resolveFetchUrl(trimmed)
  const downloadName = filename || 'document'

  return (
    <div className="kyb-document-display mb-3">
      {showLabel && <div className="text-muted small mb-1">{label}</div>}
      {loading && (
        <div className="kyb-document-display__loading small text-muted">
          <span className="spinner-border spinner-border-sm me-2" role="status" />
          Loading document…
        </div>
      )}
      {error && !loading && (
        <div className="small text-danger mb-2">{error}</div>
      )}
      {!loading && objectUrl && previewKind === 'image' && (
        <div className="kyb-document-display__preview mb-2">
          <img
            src={objectUrl}
            alt={label}
            className="kyb-document-display__image"
          />
        </div>
      )}
      {!loading && objectUrl && previewKind === 'pdf' && (
        <div className="kyb-document-display__preview mb-2">
          <iframe
            src={objectUrl}
            title={label}
            className="kyb-document-display__pdf"
          />
        </div>
      )}
      {!loading && downloadHref && (
        <a
          href={downloadHref}
          className="btn btn-sm btn-outline-secondary"
          download={previewKind === 'external' ? undefined : downloadName}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className="bi bi-download me-1" aria-hidden="true" />
          Download{downloadName !== 'document' ? ` (${downloadName})` : ''}
        </a>
      )}
    </div>
  )
}

export default KybDocumentDisplay
