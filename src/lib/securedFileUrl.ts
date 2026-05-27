import { apiFetch, buildApiUrl } from '../services/api'

function resolveFileUrl(fileUrl: string, download = false): string {
  const base = /^https?:\/\//i.test(fileUrl) ? fileUrl : buildApiUrl(fileUrl)
  if (!download) return base
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}download=1`
}

/** Fetch a JWT-protected file URL and return a temporary object URL for display. */
export async function fetchSecuredFileBlobUrl(fileUrl: string): Promise<string> {
  const res = await apiFetch(resolveFileUrl(fileUrl))
  if (!res.ok) throw new Error('Failed to load file')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
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
  anchor.download = filename || 'download'
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
