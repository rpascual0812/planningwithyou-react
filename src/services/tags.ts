import { apiFetch, authHeaders, buildApiUrl } from './api'

export type TagRecord = {
  id: number
  tag: string
  created_at: string
}

async function tagApiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>
      for (const val of Object.values(obj)) {
        if (typeof val === 'string') return new Error(val)
        if (Array.isArray(val) && typeof val[0] === 'string') return new Error(val[0])
      }
    }
  } catch {
    /* ignore */
  }
  return new Error(fallback)
}

export async function fetchTags(search = ''): Promise<TagRecord[]> {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  const qs = params.toString()
  const res = await apiFetch(buildApiUrl(`/tags/${qs ? `?${qs}` : ''}`), {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to load tags')
  return res.json()
}

export async function createTag(tag: string): Promise<TagRecord> {
  const res = await apiFetch(buildApiUrl('/tags/'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tag: tag.trim() }),
  })
  if (!res.ok) throw await tagApiError(res, 'Failed to create tag')
  return res.json()
}
