/** Strip HTML tags to plain text (for previews and compact header display). */
export function htmlToPlainText(html: string): string {
  const raw = html.trim()
  if (!raw) return ''
  const doc = new DOMParser().parseFromString(raw, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** True when HTML has visible text (ignores empty TinyMCE markup). */
export function hasMeaningfulEmailBody(html: string): boolean {
  const raw = html.trim()
  if (!raw) return false
  const doc = new DOMParser().parseFromString(raw, 'text/html')
  const text = (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim()
  return text.length > 0
}
