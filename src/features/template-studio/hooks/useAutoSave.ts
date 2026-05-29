import { useEffect } from 'react'
import { persistDraft } from '../store/templateStudioStore'
import { useTemplateStudioStore } from '../store/templateStudioStore'

const DEBOUNCE_MS = 800

/** Persists the current document to localStorage (debounced). */
export function useAutoSave() {
  const document = useTemplateStudioStore((s) => s.document)
  const isDirty = useTemplateStudioStore((s) => s.isDirty)
  const markSaved = useTemplateStudioStore((s) => s.markSaved)

  useEffect(() => {
    if (!isDirty) return
    const t = window.setTimeout(() => {
      persistDraft(document)
      markSaved()
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [document, isDirty, markSaved])

  useEffect(() => {
    const flush = () => {
      const { document: doc, isDirty: dirty } = useTemplateStudioStore.getState()
      if (dirty) {
        persistDraft(doc)
      }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [])
}
