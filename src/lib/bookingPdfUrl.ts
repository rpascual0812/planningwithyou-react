import { buildApiUrl } from '../services/api'

/** Turn a stored booking PDF path into a browser-accessible media URL. */
export function bookingPdfToMediaUrl(pdfPath: string): string {
  const raw = pdfPath.trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/media/')) return buildApiUrl(raw)

  const normalized = raw.replace(/\\/g, '/')
  const mediaIdx = normalized.indexOf('/media/')
  if (mediaIdx !== -1) {
    return buildApiUrl(normalized.slice(mediaIdx))
  }

  const relIdx = normalized.indexOf('booking_pdfs/')
  if (relIdx !== -1) {
    return buildApiUrl(`/media/${normalized.slice(relIdx)}`)
  }

  return ''
}
