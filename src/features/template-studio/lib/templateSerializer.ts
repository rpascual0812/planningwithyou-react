import type { WeddingTemplateDocument } from '../types/schema'

export function exportTemplateJson(doc: WeddingTemplateDocument): string {
  return JSON.stringify(doc, null, 2)
}

/** Ensures legacy documents without meta.title still work. */
export function normalizeDocumentMeta(
  doc: WeddingTemplateDocument,
): WeddingTemplateDocument {
  const next = structuredClone(doc)
  if (!next.meta.title) {
    next.meta.title = next.meta.name || 'Untitled template'
  }
  if (!next.meta.name) {
    next.meta.name = next.meta.title
  }
  return next
}

export function importTemplateJson(raw: string): WeddingTemplateDocument {
  const parsed = JSON.parse(raw) as WeddingTemplateDocument
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.pages)) {
    throw new Error('Invalid template document')
  }
  return normalizeDocumentMeta(parsed)
}

export function downloadTemplateJson(doc: WeddingTemplateDocument, filename?: string) {
  const blob = new Blob([exportTemplateJson(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `${(doc.meta.title || doc.meta.name).replace(/\s+/g, '-').toLowerCase() || 'template'}.json`
  a.click()
  URL.revokeObjectURL(url)
}
