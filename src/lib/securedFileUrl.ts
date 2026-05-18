import { apiFetch, buildApiUrl } from '../services/api'

/** Fetch a JWT-protected file URL and return a temporary object URL for display. */
export async function fetchSecuredFileBlobUrl(fileUrl: string): Promise<string> {
  const url = /^https?:\/\//i.test(fileUrl) ? fileUrl : buildApiUrl(fileUrl)
  const res = await apiFetch(url)
  if (!res.ok) throw new Error('Failed to load file')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
