import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchTemplateStudio } from '../../../services/templateStudioApi'
import {
  buildTemplateStudioSearchParams,
  parseTemplateIdFromSearch,
} from '../lib/templateStudioUrl'
import { useTemplateStudioStore } from '../store/templateStudioStore'

/**
 * Syncs `/invitations` with the editor store:
 * - no `id` query → blank canvas
 * - `?id=&title=` → load saved template and keep URL in sync after save
 */
export function useTemplateStudioRoute() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const loadedIdRef = useRef<number | null>(null)

  const setTemplateUrl = useCallback(
    (id: number, title: string) => {
      setSearchParams(buildTemplateStudioSearchParams(id, title), { replace: true })
      loadedIdRef.current = id
    },
    [setSearchParams],
  )

  useEffect(() => {
    const templateId = parseTemplateIdFromSearch(searchParams.toString())

    if (templateId === null) {
      loadedIdRef.current = null
      setLoadError(null)
      useTemplateStudioStore.getState().openBlankCanvas()
      return
    }

    if (loadedIdRef.current === templateId) return

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void fetchTemplateStudio(templateId)
      .then((record) => {
        if (cancelled) return
        useTemplateStudioStore.getState().loadFromRecord(record)
        loadedIdRef.current = record.id
        const titleParam = searchParams.get('title')
        const expected = buildTemplateStudioSearchParams(record.id, record.title).get('title')
        if (titleParam !== expected) {
          setSearchParams(buildTemplateStudioSearchParams(record.id, record.title), {
            replace: true,
          })
        }
      })
      .catch((e) => {
        if (cancelled) return
        loadedIdRef.current = null
        setLoadError(e instanceof Error ? e.message : 'Failed to load template')
        useTemplateStudioStore.getState().openBlankCanvas()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [searchParams, setSearchParams])

  return { loading, loadError, setTemplateUrl }
}
