/** URL-safe slug from a template title (for `/invitations?title=…`). */
export function titleToUrlSlug(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

export function buildTemplateStudioSearchParams(
  id: number,
  title: string,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('id', String(id))
  params.set('title', titleToUrlSlug(title))
  return params
}

export function buildTemplateStudioPath(id: number, title: string): string {
  const params = buildTemplateStudioSearchParams(id, title)
  return `/invitations?${params.toString()}`
}

export function parseTemplateIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get('id')
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
