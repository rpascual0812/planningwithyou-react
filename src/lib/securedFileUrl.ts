import { apiFetch, buildApiUrl } from '../services/api'

function resolveFileUrl(fileUrl: string, download = false): string {
  const base = /^https?:\/\//i.test(fileUrl) ? fileUrl : buildApiUrl(fileUrl)
  if (!download) return base
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}download=1`
}

/** Derive a display/download filename from a file URL path. */
export function attachmentFilenameFromUrl(fileUrl: string): string {
  try {
    const path = /^https?:\/\//i.test(fileUrl)
      ? new URL(fileUrl).pathname
      : fileUrl.split('?')[0]
    const segments = path.split('/').filter(Boolean)
    const last = segments[segments.length - 1] || ''
    const prev = segments[segments.length - 2] || ''

    // Secured proxy routes end with /pdf — last segment is not the filename.
    if (last.toLowerCase() === 'pdf' && prev) {
      const route = segments[segments.length - 3] || ''
      const id = prev
      if (route === 'r') return `receipt-${id}.pdf`
      if (route === 'b') return `quotation-${id}.pdf`
      if (route === 'sr') return `subscription-receipt-${id}.pdf`
      if (route === 'd') return `document-${id}`
      return `file-${id}.pdf`
    }

    const base = decodeURIComponent(last) || 'attachment'
    if (base.toLowerCase() === 'pdf') return 'attachment.pdf'
    return base.includes('.') ? base : `${base}.pdf`
  } catch {
    return 'attachment.pdf'
  }
}

/** Fetch a JWT-protected file URL and return a temporary object URL for display. */
export async function fetchSecuredFileBlobUrl(fileUrl: string): Promise<string> {
  const res = await apiFetch(resolveFileUrl(fileUrl))
  if (!res.ok) throw new Error('Failed to load file')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/** Parse filename from Content-Disposition when present. */
function filenameFromContentDisposition(header: string | null): string {
  if (!header) return ''
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      return utf8[1].trim()
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]
  const plain = header.match(/filename=([^;]+)/i)
  return plain?.[1]?.trim() ?? ''
}

/** Download a JWT-protected file without opening a new browser tab. */
export async function downloadSecuredFile(
  fileUrl: string,
  filename: string,
): Promise<void> {
  const res = await apiFetch(resolveFileUrl(fileUrl, true))
  if (!res.ok) throw new Error('Failed to download file')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  const headerName = filenameFromContentDisposition(
    res.headers.get('Content-Disposition'),
  )
  const fallback =
    filename && filename.toLowerCase() !== 'pdf' ? filename : 'attachment.pdf'
  anchor.download = headerName || fallback
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
